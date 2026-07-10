---
title: OTA Updates on STM32
description: Covers the full OTA picture — boot flow, Flash layout, Bootloader, protocols, security, and recovery.
date: 2026-07-10
category: Tech
tags: [STM32, OTA, Software, Learning, Embedded]
cover: https://assets.virongx.com/blog/covers/STM32_OTA.png
---

> Suggested learning order: STM32 boot flow → BootLoader jump to App → Flash erase/program → CAN OTA protocol → dual-App upgrade → cloud OTA

# OTA Upgrades with an STM32 BootLoader

OTA (Over-The-Air) updates firmware remotely without JTAG or a debugger—convenient and fast for field devices.

An STM32 BootLoader OTA stack must solve three problems: **reliable firmware storage layout**, **upgrade safety**, and **failure recovery**.

Let’s walk through the flow step by step.

## 1. STM32 Boot Flow

> Goal: understand why OTA is possible.

See the full boot sequence in [STM32 Boot Flow](/blog/STM32_bootloader/) — here we only cover what matters for OTA.

**Core idea**: after power-on the MCU reads the vector table at Flash base (0x08000000), loads MSP and Reset_Handler, and starts executing.

```
Power-on → BootROM → read 0x08000000 → load MSP & Reset_Handler → run
```

**What OTA relies on**:
1. Flash can be partitioned: Bootloader + App A + App B
2. Bootloader can jump to Applications at different addresses
3. Flash is erasable/programmable for updates

**Boot decision flow**:

```
MCU reset → Bootloader @ 0x08000000
    ↓
Upgrade requested?
    ↓ yes
Receive firmware → write backup slot → verify → mark active partition
    ↓ no
Read active-partition flag
    ↓
App A active & valid? → jump App A
App B active & valid? → jump App B
Both fail? → stay in upgrade mode
```

---

## 2. Flash Partition Design

> Goal: storage architecture — the foundation of OTA.

### 2.1 Three Layout Options

#### Option 1: Single App (not recommended)

```
┌──────────────────────────────┐ 0x08000000
│  Bootloader (32KB)           │
├──────────────────────────────┤ 0x08008000
│  Application (240KB)         │ ← running
├──────────────────────────────┤ 0x08044000
│  Download Buffer (240KB)     │ ← staging
└──────────────────────────────┘ 0x08080000
```

Flow: download to buffer → erase App → copy buffer → reboot.

**Fatal flaw**: power loss during copy bricks the device—App destroyed with no backup.

#### Option 2: Dual App (recommended)

```
┌──────────────────────────────┐ 0x08000000
│  Bootloader (32KB)           │ ← never updated
├──────────────────────────────┤ 0x08008000
│  App A (240KB)               │ ← old firmware
├──────────────────────────────┤ 0x08044000
│  App B (240KB)               │ ← new firmware
├──────────────────────────────┤ 0x0807F000
│  Params (4KB)                │ ← flags & versions
└──────────────────────────────┘ 0x08080000
```

Flow: download to inactive slot → verify → flip active flag → reboot.

**Pros**:
- ✅ Rollback on failure
- ✅ Old firmware still runs after power loss mid-upgrade
- ✅ A/B ping-pong updates

#### Option 3: Compressed firmware (advanced)

Store compressed image in Flash; Bootloader decompresses (e.g. tinflate). Saves space and transfer time at the cost of Bootloader complexity.

### 2.2 Parameter Area

Must survive power loss.

#### Option A: Last Flash sector (recommended)

```c
#define PARAMS_ADDR      0x0807F000

typedef struct {
    uint32_t magic;              // 0x5AA5F00F
    uint8_t  active_partition;   // 0=App A, 1=App B
    uint8_t  boot_count;
    uint8_t  update_flag;        // 0=normal, 1=wait, 2=updating
    uint8_t  reserved;
    uint32_t app_a_version;
    uint32_t app_a_size;
    uint32_t app_a_crc32;
    uint32_t app_b_version;
    uint32_t app_b_size;
    uint32_t app_b_crc32;
    uint32_t crc;
} BootParams_t;
```

Read/write via `memcpy` from Flash; updates require erase + program (see Chinese article for full HAL example).

#### Option B: RTC backup registers

Fast, 128 bytes total—good for flags only, not large metadata.

### 2.3 Address Macros

```c
#define FLASH_BASE_ADDR       0x08000000
#define BOOTLOADER_ADDR       (FLASH_BASE_ADDR)
#define BOOTLOADER_SIZE       (32 * 1024)
#define APP_A_ADDR            (BOOTLOADER_ADDR + BOOTLOADER_SIZE)
#define APP_A_SIZE            (240 * 1024)
#define APP_B_ADDR            (APP_A_ADDR + APP_A_SIZE)
#define APP_B_SIZE            (240 * 1024)
#define PARAMS_ADDR           (0x0807F000)
```

---

## 3. Bootloader Core Logic

### 3.1 Main Flow

```c
int main(void) {
    HAL_Init();
    SystemClock_Config();
    UART_Init();  // or CAN / ETH

    BootParams_t params;
    ReadBootParams(&params);

    if (IsUpgradeButtonPressed() || params.update_flag == UPDATE_REQUESTED) {
        EnterUpdateMode();
        return 0;
    }

    params.boot_count++;
    if (params.boot_count > 3) {
        params.active_partition ^= 1;
        params.boot_count = 0;
    }
    WriteBootParams(&params);

    uint32_t app_addr = /* pick A or B, fallback if verify fails */;
    if (!VerifyApplication(app_addr, 0, 0)) {
        EnterUpdateMode();
        return 0;
    }

    JumpToApplication(app_addr);
    while(1);
}
```

### 3.2 Firmware Verification

```c
bool VerifyApplication(uint32_t app_addr, uint32_t size, uint32_t expected_crc) {
    if (!IS_FLASH_ADDR(app_addr)) return false;

    uint32_t msp = *(volatile uint32_t*)app_addr;
    if ((msp & 0x2FFE0000) != 0x20000000) return false;

    uint32_t reset_handler = *(volatile uint32_t*)(app_addr + 4);
    if (!IS_FLASH_ADDR(reset_handler) || (reset_handler & 0x1) == 0) return false;

    if (size > 0 && expected_crc != 0) {
        if (CRC32_Calculate((uint8_t*)app_addr, size) != expected_crc) return false;
    }
    return true;
}
```

- Stack pointer check avoids HardFault on bad images
- Reset_Handler must be valid Thumb address in Flash
- CRC catches transport/write errors

### 3.3 Jump to Application

Disable IRQs, clear NVIC, stop SysTick, `HAL_RCC_DeInit()`, set `SCB->VTOR`, load MSP, branch to App Reset_Handler.

| Step | Why |
|------|-----|
| Deinit peripherals | No stray IRQ during App init |
| Disable IRQ | Wrong vector table → HardFault |
| Stop SysTick | App reconfigures it |
| Set VTOR | CPU uses App’s vectors |
| Set MSP | App may use different stack |

---

## 4. Flash Read/Write

### 4.1 Series Comparison

| Series | Erase unit | Program unit | Typical endurance |
|--------|------------|--------------|-------------------|
| F1 | 1–2 KB page | half-word | 10k |
| F4 | 16–128 KB sector | byte | 10k |
| G4 | 2 KB page | double-word (8 B) | 10k |
| H7 | 8 KB sector | 256 bit | 100k |

Flash must be erased before write; bits only go 1→0.

### 4.2 HAL Erase / Program

Use `HAL_FLASHEx_Erase` for pages/sectors, `HAL_FLASH_Program` with correct alignment (8 bytes on G4), optional read-back `memcmp`.

### 4.3 Optimizations

- **Page cache**: batch writes, one erase per page
- **Background erase**: erase target region before download starts

---

## 5. Communication Protocol

### 5.1 Transport Options

| Link | Speed | Range | Use case |
|------|-------|-------|----------|
| UART | 115k–921k | <15 m | Debug, local |
| CAN | 1 Mbps | <40 m | Vehicle, industrial |
| Ethernet | 100 Mbps | LAN | Networked devices |
| Wi-Fi | variable | wireless | IoT |

### 5.2 Frame Format

```
Header(0xAA55) | CMD(1) | Length(2) | Data(0~1024) | CRC16(2) | Tail(0x55AA)
```

Commands: `CMD_HANDSHAKE`, `CMD_START_UPDATE`, `CMD_SEND_DATA`, `CMD_END_UPDATE`, `CMD_VERIFY`, `CMD_REBOOT`, `CMD_ACK`, `CMD_NACK`.

Error codes: CRC, invalid cmd, erase/write fail, size overflow, low version, verify fail.

### 5.3 Upgrade Sequence

Host: handshake → start (size, version, CRC) → data packets → end → verify → reboot. Device ACK/NACK each step; on success Bootloader switches partition and resets.

---

## 6. Encryption and Security

**Threats**: firmware sniffing, malicious images, MITM tampering, rollback to vulnerable versions.

| Approach | Security | Notes |
|----------|----------|-------|
| Plain + CRC | ⭐ | Lab only |
| AES | ⭐⭐⭐ | Symmetric, fast on STM32 CRYP |
| RSA signature | ⭐⭐⭐⭐ | Proves origin |
| AES + RSA | ⭐⭐⭐⭐⭐ | Encrypt + sign |

Include AES-256-CBC encrypt on host, decrypt in Bootloader with hardware AES; RSA-SHA256 sign on server, verify with mbedTLS on device; **secure boot** checks signature, minimum version, and hardware ID before jump.

---

## 7. Fault Tolerance

| Failure | When | Recovery |
|---------|------|----------|
| Link drop | Transfer | Resume from offset |
| Power loss | Program | Run other partition |
| CRC fail | End | Keep old firmware |
| Crash loop | After boot | boot_count → rollback |
| Bad erase | Prep | Mark bad region |

Also use **IWDG** during long upgrades.

---

## 8. Project Checklist

1. Linker script: App offset (e.g. 0x08008000)
2. App `SystemInit`: `VTOR` offset
3. Flash erase/write + verify
4. OTA protocol handler
5. Host tool (Python/C#)

Projects: Bootloader (~32 KB), Application (~240 KB), PC uploader.

---

## 9. Summary and Best Practices

**Checklist**:
- ✅ Dual-bank A/B with rollback
- ✅ CRC32 + optional RSA
- ✅ Resume + boot-count guard
- ✅ Encryption for sensitive products
- ✅ Upgrade logs
- ✅ Watchdog during OTA
- ✅ Anti-rollback version policy

| Issue | Cause | Fix |
|-------|-------|-----|
| HardFault after jump | VTOR | Set in App SystemInit |
| Write fail | No erase / misalign | Align to program width |
| CRC mismatch | Algorithm drift | Same poly on host & device |
| Boot loop | Bad new App | boot_count rollback |

**Learning path**:

```
Boot flow → partitions → Bootloader → Flash ops → protocol →
verify → crypto → fault handling → full project
```

**References**:
- AN2606: STM32 system memory boot mode
- AN4657: STM32 in-application programming
- UM2552: STM32Cube examples
- NIST FIPS 197: AES

Thanks for reading — see you in the next post.

**Last updated: July 10, 2026 10:35:35**
