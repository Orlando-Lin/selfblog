---
title: OTA Updates on STM32
description: Covers all OTA scenarios.
date: 2026-07-10
category: Tech
tags: [STM32, OTA, Software, Learning, Embedded]
cover: https://assets.virongx.com/blog/covers/STM32_OTA.png
---

> Suggested learning order: understand STM32 boot flow → write BootLoader jump to App → Flash erase/program → CAN OTA protocol → dual-App upgrade → cloud OTA

# OTA Upgrades with an STM32 BootLoader

Remote upgrade OTA (Over-The-Air); no need to program via JTAG or similar—update firmware dynamically over wireless communication, convenient and fast.

An STM32 BootLoader OTA implementation must solve three core problems: 1) how to design a reliable firmware storage structure; 2) how to ensure upgrade safety; 3) how to implement failure recovery.

Next, let's walk through the flow step by step!

## Contents

- [1. STM32 Boot Flow](#1-stm32-boot-flow)
- [2. Flash Partition Design](#2-flash-partition-design)
- [3. Bootloader Core Implementation](#3-bootloader-core-implementation)
- [4. Flash Read/Write Details](#4-flash-readwrite-details)
- [5. Communication Protocol](#5-communication-protocol)
- [6. Firmware Encryption and Security](#6-firmware-encryption-and-security)
- [7. Exception Handling and Fault Tolerance](#7-exception-handling-and-fault-tolerance)
- [8. Complete Project Walkthrough](#8-complete-project-walkthrough)
- [9. Summary and Best Practices](#9-summary-and-best-practices)

## 1. STM32 Boot Flow

> Goal: understand why OTA is possible.

See the full boot flow in [STM32 Boot Flow](https://virongx.com/blog/STM32_bootloader/)—here we only cover the parts relevant to OTA.

**Core principle**: After power-on, STM32 reads the interrupt vector table from the Flash start address (0x08000000) and jumps to Reset_Handler for execution.

```
Power-on → BootROM → read 0x08000000 → load MSP and Reset_Handler → start executing program
```

**Key points OTA leverages**:
1. Flash can be partitioned: Bootloader region + App A region + App B region
2. Bootloader can control jumping to Applications at different addresses
3. Flash can be erased and programmed to update firmware

**Boot decision flow**:
```
MCU reset → Bootloader starts (0x08000000)
    ↓
Upgrade request pending?
    ↓ yes
Receive new firmware → write to backup region → verify → mark as active partition
    ↓ no
Read active partition flag
    ↓
App A active? Verification passed? → jump App A
App B active? Verification passed? → jump App B
Both failed? → enter upgrade mode and wait for firmware
```

---

## 2. Flash Partition Design

> Goal: understand the OTA storage architecture—this is the foundation of the entire system.

### 2.1 Comparison of Three Partition Schemes

#### Scheme 1: Single Application Region (Not Recommended)

```
┌──────────────────────────────┐ 0x08000000
│  Bootloader (32KB)           │
├──────────────────────────────┤ 0x08008000
│  Application (240KB)         │ ← currently running
├──────────────────────────────┤ 0x08044000
│  Download Buffer (240KB)     │ ← temporary storage for new firmware
└──────────────────────────────┘ 0x08080000
```

**Upgrade flow**: download to Buffer → erase App → copy Buffer to App → reboot

**Fatal flaw**: if power is lost during the copy, the App region is destroyed with no backup—the device bricks!

#### Scheme 2: Dual Application Regions (Recommended)

```
┌──────────────────────────────┐ 0x08000000
│  Bootloader (32KB)           │ ← never updated
├──────────────────────────────┤ 0x08008000
│  App A (240KB)               │ ← old firmware version
├──────────────────────────────┤ 0x08044000
│  App B (240KB)               │ ← new firmware version
├──────────────────────────────┤ 0x0807F000
│  Params (4KB)                │ ← stores flags and version info
└──────────────────────────────┘ 0x08080000
```

**Upgrade flow**: download to backup region (App B) → verify → switch active flag → reboot → run new firmware

**Advantages**:
- ✅ Failed upgrade can roll back
- ✅ Old firmware still runs after power loss
- ✅ Supports A/B ping-pong upgrades

#### Scheme 3: Compressed Firmware + Decompression (Advanced)

```
┌──────────────────────────────┐
│  Bootloader (32KB)           │
├──────────────────────────────┤
│  Application (240KB)         │
├──────────────────────────────┤
│  Compressed FW (120KB)       │ ← compressed firmware package (saves 50% space)
└──────────────────────────────┘
```

**Advantage**: saves transfer time and Flash space

**Cost**: requires integrating a decompression library (e.g. tinflate), increasing Bootloader complexity

### 2.2 Parameter Region Design

The parameter region stores system state and must survive power loss.

#### Option A: Last Flash Sector (Recommended)

```c
// Define parameter region address (STM32G4, 512KB Flash example)
#define PARAMS_ADDR      0x0807F000  // Last 4KB sector

typedef struct {
    uint32_t magic;              // 0x5AA5F00F (identify parameter region validity)
    uint8_t  active_partition;   // 0=App A, 1=App B
    uint8_t  boot_count;         // Boot count (detect reboot loops)
    uint8_t  update_flag;        // 0=normal run, 1=awaiting upgrade, 2=upgrading
    uint8_t  reserved;
    
    // App A info
    uint32_t app_a_version;
    uint32_t app_a_size;
    uint32_t app_a_crc32;
    
    // App B info
    uint32_t app_b_version;
    uint32_t app_b_size;
    uint32_t app_b_crc32;
    
    uint32_t crc;                // Parameter region self CRC check
} BootParams_t;
```

**Read/write example**:
```c
// Read parameters
BootParams_t params;
memcpy(&params, (void*)PARAMS_ADDR, sizeof(BootParams_t));

// Verify parameter validity
if (params.magic != 0x5AA5F00F || CRC32_Check(&params) != params.crc) {
    // Parameters corrupted, restore defaults
    InitDefaultParams(&params);
}

// Update parameters (must erase sector first)
HAL_FLASH_Unlock();
FLASH_EraseInitTypeDef erase = {
    .TypeErase = FLASH_TYPEERASE_PAGES,
    .Page = 127,  // Last page
    .NbPages = 1
};
uint32_t error;
HAL_FLASHEx_Erase(&erase, &error);

// Write new parameters
uint32_t *src = (uint32_t*)&params;
for (int i = 0; i < sizeof(BootParams_t)/4; i++) {
    HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD, PARAMS_ADDR + i*4, src[i]);
}
HAL_FLASH_Lock();
```

#### Option B: RTC Backup Registers (Fast but Small Capacity)

```c
// STM32G4 has 32 32-bit backup registers (128 bytes)
#define BOOT_MAGIC_REG     RTC->BKP0R
#define ACTIVE_PART_REG    RTC->BKP1R
#define APP_A_VER_REG      RTC->BKP2R
#define APP_B_VER_REG      RTC->BKP3R

// Enable backup domain access before writing
__HAL_RCC_PWR_CLK_ENABLE();
HAL_PWR_EnableBkUpAccess();

BOOT_MAGIC_REG = 0x5AA5F00F;
ACTIVE_PART_REG = 1;  // Switch to App B

HAL_PWR_DisableBkUpAccess();
```

**Pros**: fast read/write, no erase needed  
**Cons**: small capacity, not suitable for storing large amounts of information

### 2.3 Address Macro Definitions (Use Consistently in Code)

```c
// flash_map.h - Flash partition mapping
#define FLASH_BASE_ADDR       0x08000000

// Bootloader region
#define BOOTLOADER_ADDR       (FLASH_BASE_ADDR)
#define BOOTLOADER_SIZE       (32 * 1024)  // 32KB

// App A region
#define APP_A_ADDR            (BOOTLOADER_ADDR + BOOTLOADER_SIZE)
#define APP_A_SIZE            (240 * 1024) // 240KB

// App B region
#define APP_B_ADDR            (APP_A_ADDR + APP_A_SIZE)
#define APP_B_SIZE            (240 * 1024)

// Parameter region
#define PARAMS_ADDR           (0x0807F000)
#define PARAMS_SIZE           (4 * 1024)

// Address validity check macro
#define IS_FLASH_ADDR(addr)   ((addr) >= FLASH_BASE_ADDR && \
                               (addr) < (FLASH_BASE_ADDR + 512*1024))
```

---

## 3. Bootloader Core Implementation

> Goal: master the key Bootloader code implementation.

### 3.1 Bootloader Main Flow

```c
// main.c - Bootloader main function
int main(void) {
    HAL_Init();
    SystemClock_Config();
    
    // 1. Initialize peripherals (for receiving firmware)
    UART_Init();  // or CAN_Init() / ETH_Init()
    
    // 2. Read boot parameters
    BootParams_t params;
    ReadBootParams(&params);
    
    // 3. Check if forced into upgrade mode
    if (IsUpgradeButtonPressed() || params.update_flag == UPDATE_REQUESTED) {
        EnterUpdateMode();  // Wait to receive new firmware
        return 0;
    }
    
    // 4. Detect boot loop (prevent bad firmware infinite reboot)
    params.boot_count++;
    if (params.boot_count > 3) {
        // More than 3 reboots, firmware may be problematic
        params.active_partition ^= 1;  // Switch to backup partition
        params.boot_count = 0;
    }
    WriteBootParams(&params);
    
    // 5. Determine App address to jump to
    uint32_t app_addr;
    if (params.active_partition == 0) {
        app_addr = APP_A_ADDR;
        if (!VerifyApplication(app_addr, params.app_a_size, params.app_a_crc32)) {
            app_addr = APP_B_ADDR;  // App A corrupted, try App B
        }
    } else {
        app_addr = APP_B_ADDR;
        if (!VerifyApplication(app_addr, params.app_b_size, params.app_b_crc32)) {
            app_addr = APP_A_ADDR;  // App B corrupted, try App A
        }
    }
    
    // 6. Final verification
    if (!VerifyApplication(app_addr, 0, 0)) {
        // Both partitions corrupted, enter upgrade mode
        EnterUpdateMode();
        return 0;
    }
    
    // 7. Jump to application
    JumpToApplication(app_addr);
    
    // Should not reach here
    while(1);
}
```

### 3.2 Firmware Verification Function

Verification is the safety guarantee of OTA, preventing running corrupted or malicious firmware.

```c
// verify.c - Firmware verification
bool VerifyApplication(uint32_t app_addr, uint32_t size, uint32_t expected_crc) {
    // 1. Check address validity
    if (!IS_FLASH_ADDR(app_addr)) {
        return false;
    }
    
    // 2. Check stack pointer validity (first entry in vector table)
    uint32_t msp = *(volatile uint32_t*)app_addr;
    if ((msp & 0x2FFE0000) != 0x20000000) {
        // Stack pointer must be within SRAM range (0x20000000 ~ 0x2001FFFF)
        return false;
    }
    
    // 3. Check Reset_Handler address validity (second entry in vector table)
    uint32_t reset_handler = *(volatile uint32_t*)(app_addr + 4);
    if (!IS_FLASH_ADDR(reset_handler) || (reset_handler & 0x1) == 0) {
        // Reset_Handler must be in Flash with LSB set (Thumb instruction)
        return false;
    }
    
    // 4. CRC check (optional, if size and expected_crc provided)
    if (size > 0 && expected_crc != 0) {
        uint32_t calc_crc = CRC32_Calculate((uint8_t*)app_addr, size);
        if (calc_crc != expected_crc) {
            return false;
        }
    }
    
    return true;
}

// CRC32 calculation (hardware CRC peripheral)
uint32_t CRC32_Calculate(uint8_t *data, uint32_t size) {
    __HAL_RCC_CRC_CLK_ENABLE();
    CRC->CR = CRC_CR_RESET;  // Reset CRC
    
    uint32_t *ptr = (uint32_t*)data;
    uint32_t len = size / 4;
    
    for (uint32_t i = 0; i < len; i++) {
        CRC->DR = ptr[i];
    }
    
    // Handle remaining bytes
    uint32_t remain = size % 4;
    if (remain > 0) {
        uint32_t last = 0;
        memcpy(&last, &data[len*4], remain);
        CRC->DR = last;
    }
    
    return CRC->DR;
}
```

**Why multiple checks?**
- Stack pointer check: prevents jumping to invalid address causing HardFault
- Reset_Handler check: ensures a valid entry function exists
- CRC check: detects data integrity (transfer errors, Flash write errors)

### 3.3 Jump to Application

This is the most critical Bootloader operation—it must correctly clean up the environment.

```c
// jump.c - Jump to application
void JumpToApplication(uint32_t app_addr) {
    // 0. Clear update flag and boot count (after successful boot)
    // Note: should clear after App runs stably; set a flag here first
    
    // 1. Shut down all peripherals in use
    HAL_UART_DeInit(&huart1);
    HAL_CAN_DeInit(&hcan1);
    // ... other peripherals
    
    // 2. Disable all interrupts
    __disable_irq();
    
    for (uint8_t i = 0; i < 8; i++) {
        NVIC->ICER[i] = 0xFFFFFFFF;  // Disable all interrupts
        NVIC->ICPR[i] = 0xFFFFFFFF;  // Clear all interrupt pending flags
    }
    
    // 3. Disable SysTick
    SysTick->CTRL = 0;
    SysTick->LOAD = 0;
    SysTick->VAL = 0;
    
    // 4. Reset all peripheral clocks (optional but recommended)
    HAL_RCC_DeInit();
    
    // 5. Relocate vector table
    SCB->VTOR = app_addr;
    
    // 6. Read App stack pointer and entry address
    uint32_t msp = *(volatile uint32_t*)app_addr;
    uint32_t reset_handler = *(volatile uint32_t*)(app_addr + 4);
    
    // 7. Set stack pointer
    __set_MSP(msp);
    
    // 8. Jump to App's Reset_Handler
    void (*app_entry)(void) = (void(*)(void))reset_handler;
    app_entry();
    
    // Should not reach here
    while(1);
}
```

**Key notes**:

| Step | Why it must be done |
|------|-------------|
| Shut down peripherals | Avoid peripheral interrupts affecting App initialization |
| Disable interrupts | Prevent vector table mismatch causing HardFault |
| Disable SysTick | App will reconfigure SysTick; leaving it on causes conflict |
| Relocate VTOR | Let CPU find App's interrupt vector table |
| Set MSP | App stack space may differ from Bootloader |

---

## 4. Flash Read/Write Details

> Goal: master Flash programming—the core technology for writing firmware.

### 4.1 STM32 Flash Basics

#### Flash Characteristics by Series

| Series | Erase unit | Program unit | Erase time | Typical erase cycles |
|------|---------|---------|---------|-------------|
| F1   | 1KB/2KB page | Half-word (2 bytes) | ~20ms/page | 10,000 |
| F4   | 16KB~128KB sector | Byte | ~500ms/sector | 10,000 |
| G4   | 2KB page | Double-word (8 bytes) | ~25ms/page | 10,000 |
| H7   | 8KB sector | 256-bit (32 bytes) | ~5ms/sector | 100,000 |

**Key characteristics**:
- ✅ Flash must be erased (all 1s) before writing
- ✅ Writing can only change 1 to 0, not 0 to 1
- ✅ Erase cycles are limited; frequent erase/program reduces lifetime

### 4.2 HAL Flash Operation Wrappers

#### 4.2.1 Erase Flash

```c
// flash_ops.c - Flash operations
bool Flash_EraseSector(uint32_t addr, uint32_t size) {
    HAL_FLASH_Unlock();
    
    // Calculate pages to erase (STM32G4 example, 2KB/page)
    uint32_t start_page = (addr - FLASH_BASE_ADDR) / FLASH_PAGE_SIZE;
    uint32_t num_pages = (size + FLASH_PAGE_SIZE - 1) / FLASH_PAGE_SIZE;
    
    FLASH_EraseInitTypeDef erase_init = {
        .TypeErase = FLASH_TYPEERASE_PAGES,
        .Banks = FLASH_BANK_1,  // Select bank by address
        .Page = start_page,
        .NbPages = num_pages
    };
    
    uint32_t page_error = 0;
    HAL_StatusTypeDef status = HAL_FLASHEx_Erase(&erase_init, &page_error);
    
    HAL_FLASH_Lock();
    
    if (status != HAL_OK || page_error != 0xFFFFFFFF) {
        // Erase failed, record error page
        return false;
    }
    
    return true;
}
```

#### 4.2.2 Write Flash

```c
bool Flash_Write(uint32_t addr, uint8_t *data, uint32_t size) {
    if (addr % 8 != 0) {
        // STM32G4 requires 8-byte alignment
        return false;
    }
    
    HAL_FLASH_Unlock();
    
    uint32_t offset = 0;
    while (offset < size) {
        uint64_t dword = 0;
        uint32_t chunk = (size - offset) >= 8 ? 8 : (size - offset);
        
        memcpy(&dword, &data[offset], chunk);
        
        HAL_StatusTypeDef status = HAL_FLASH_Program(
            FLASH_TYPEPROGRAM_DOUBLEWORD,
            addr + offset,
            dword
        );
        
        if (status != HAL_OK) {
            HAL_FLASH_Lock();
            return false;
        }
        
        offset += 8;
    }
    
    HAL_FLASH_Lock();
    
    // Read-back verification (optional but recommended)
    if (memcmp((void*)addr, data, size) != 0) {
        return false;
    }
    
    return true;
}
```

### 4.3 Flash Write Optimization Tips

#### Tip 1: Page Cache (Reduce Erase Count)

```c
#define PAGE_BUFFER_SIZE  2048  // 2KB page cache

typedef struct {
    uint8_t buffer[PAGE_BUFFER_SIZE];
    uint32_t base_addr;
    uint32_t write_pos;
    bool dirty;
} FlashPageCache_t;

FlashPageCache_t g_cache = {0};

bool Flash_WriteWithCache(uint32_t addr, uint8_t *data, uint32_t size) {
    for (uint32_t i = 0; i < size; i++) {
        uint32_t target_addr = addr + i;
        uint32_t page_base = target_addr & ~(PAGE_BUFFER_SIZE - 1);
        
        // Check if cache needs flushing
        if (g_cache.dirty && g_cache.base_addr != page_base) {
            FlushCache();
        }
        
        // First write to this page, read entire page content first
        if (!g_cache.dirty || g_cache.base_addr != page_base) {
            memcpy(g_cache.buffer, (void*)page_base, PAGE_BUFFER_SIZE);
            g_cache.base_addr = page_base;
            g_cache.dirty = false;
        }
        
        // Write to cache
        g_cache.buffer[target_addr - page_base] = data[i];
        g_cache.dirty = true;
    }
    
    return true;
}

void FlushCache(void) {
    if (!g_cache.dirty) return;
    
    Flash_EraseSector(g_cache.base_addr, PAGE_BUFFER_SIZE);
    Flash_Write(g_cache.base_addr, g_cache.buffer, PAGE_BUFFER_SIZE);
    
    g_cache.dirty = false;
}
```

**Advantages**:
- Multiple writes within the same page erase only once
- Reduces Flash erase count, extends lifetime

#### Tip 2: Background Erase (Improve User Experience)

```c
// Pre-erase target region before receiving firmware
void PrepareFlashArea(uint32_t addr, uint32_t size) {
    // Show progress: erasing...
    Flash_EraseSector(addr, size);
    // Erase complete, waiting for data
}

// Write directly when receiving data, no erase wait
void OnDataReceived(uint8_t *data, uint32_t size) {
    Flash_Write(g_current_addr, data, size);
    g_current_addr += size;
}
```

---

## 5. Communication Protocol

> Goal: implement firmware transfer protocol supporting UART/CAN/Ethernet and other methods.

### 5.1 Protocol Selection Comparison

| Protocol | Speed | Distance | Complexity | Use case |
|------|------|------|--------|---------|
| UART | 115200~921600 bps | <15m | Low | Debug, local upgrade |
| CAN  | 1Mbps | <40m | Medium | Automotive, industrial control |
| SPI  | 10Mbps+ | <1m | Low | External Flash storage |
| Ethernet | 100Mbps | <100m | High | Network devices |
| USB  | 12Mbps (FS) | <5m | Medium | PC-connected upgrade |
| Wi-Fi | 1~100Mbps | <50m | High | IoT devices |
### 5.2 General OTA Protocol Design

Design a simple but reliable protocol adaptable to multiple communication methods.

#### 5.2.1 Protocol Frame Format

```
┌────────┬────────┬────────┬────────────┬──────────┬────────┐
│ Header │ CMD    │ Length │ Data       │ CRC16    │ Tail   │
│ 2Byte  │ 1Byte  │ 2Byte  │ 0~1024Byte │ 2Byte    │ 2Byte  │
└────────┴────────┴────────┴────────────┴──────────┴────────┘
  0xAA55   Command   Data length   Actual data   Checksum   0x55AA
```

**Field description**:
- **Header (0xAA55)**: frame header for synchronization
- **CMD**: command code (see table below)
- **Length**: Data field length (excluding other fields)
- **Data**: command parameters or firmware data
- **CRC16**: checksum (all bytes from CMD to Data)
- **Tail (0x55AA)**: frame tail

#### 5.2.2 Command Definitions

```c
// ota_protocol.h
typedef enum {
    CMD_HANDSHAKE       = 0x01,  // Handshake, establish connection
    CMD_GET_INFO        = 0x02,  // Get device info
    CMD_START_UPDATE    = 0x10,  // Start upgrade (send firmware info)
    CMD_SEND_DATA       = 0x11,  // Send firmware data packet
    CMD_END_UPDATE      = 0x12,  // End upgrade
    CMD_VERIFY          = 0x13,  // Verify firmware
    CMD_REBOOT          = 0x14,  // Reboot device
    
    CMD_ACK             = 0xA0,  // Acknowledge success
    CMD_NACK            = 0xA1,  // Acknowledge failure (carries error code)
} OTA_CMD_t;

typedef enum {
    ERR_NONE            = 0x00,
    ERR_CRC             = 0x01,  // Checksum error
    ERR_INVALID_CMD     = 0x02,  // Invalid command
    ERR_FLASH_ERASE     = 0x03,  // Flash erase failed
    ERR_FLASH_WRITE     = 0x04,  // Flash write failed
    ERR_SIZE_OVERFLOW   = 0x05,  // Firmware size overflow
    ERR_VERSION_LOW     = 0x06,  // Version too low
    ERR_VERIFY_FAIL     = 0x07,  // Firmware verification failed
} OTA_ERROR_t;
```

#### 5.2.3 Upgrade Flow Sequence Diagram

```
Host PC                              Device
  │                                  │
  ├───── CMD_HANDSHAKE ──────────────>│
  │                                  │ Check if in Bootloader mode
  │<────── CMD_ACK (device info) ───────┤
  │                                  │
  ├───── CMD_START_UPDATE ───────────>│ Firmware size, version, CRC
  │                                  │ Check version, erase Flash
  │<────── CMD_ACK ──────────────────┤
  │                                  │
  ├───── CMD_SEND_DATA (packet 0) ────────>│ Write Flash
  │<────── CMD_ACK ──────────────────┤
  ├───── CMD_SEND_DATA (packet 1) ────────>│
  │<────── CMD_ACK ──────────────────┤
  │          ... (loop send) ...       │
  ├───── CMD_SEND_DATA (packet N) ────────>│
  │<────── CMD_ACK ──────────────────┤
  │                                  │
  ├───── CMD_END_UPDATE ─────────────>│
  │<────── CMD_ACK ──────────────────┤
  │                                  │
  ├───── CMD_VERIFY ─────────────────>│ CRC verify entire firmware
  │<────── CMD_ACK or CMD_NACK ──────┤
  │                                  │
  ├───── CMD_REBOOT ─────────────────>│ Set boot flag, reboot
  │                                  │
  │                              [Device reboots]
  │                                  │
  │                          [New firmware starts running]
```

---

## 6. Firmware Encryption and Security

> Goal: protect firmware from theft or tampering, improve OTA security.

### 6.1 Why Encryption?

**Threat scenarios**:
- 🔓 Firmware intercepted and analyzed, leaking algorithms and trade secrets
- 🔓 Malicious firmware injected, device controlled by attacker
- 🔓 Man-in-the-middle attack, firmware tampered during transfer
- 🔓 Rollback attack, forced downgrade to old version with vulnerabilities

### 6.2 Encryption Scheme Selection

| Scheme | Security | Performance | Complexity | Use case |
|------|-------|------|--------|---------|
| Plaintext + CRC | ⭐ | Very fast | Low | Internal testing |
| AES symmetric encryption | ⭐⭐⭐ | Fast | Medium | General purpose |
| RSA signature verification | ⭐⭐⭐⭐ | Slow | High | High security requirements |
| AES+RSA hybrid | ⭐⭐⭐⭐⭐ | Medium | High | Finance, automotive |

### 6.3 AES Encryption Implementation

#### 6.3.1 Firmware Encryption (Host PC/Server Side)

```python
# encrypt_firmware.py - Firmware encryption tool
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import struct

def encrypt_firmware(fw_data, key):
    """
    Encrypt firmware using AES-256-CBC
    """
    # Generate random IV (initialization vector)
    iv = get_random_bytes(16)
    
    # Pad to 16-byte alignment
    pad_len = 16 - (len(fw_data) % 16)
    fw_data += bytes([pad_len] * pad_len)
    
    # Encrypt
    cipher = AES.new(key, AES.MODE_CBC, iv)
    encrypted = cipher.encrypt(fw_data)
    
    # Return: IV + encrypted data
    return iv + encrypted

# Usage example
AES_KEY = bytes.fromhex('0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF')

with open('app.bin', 'rb') as f:
    fw_data = f.read()

encrypted_fw = encrypt_firmware(fw_data, AES_KEY)

with open('app_encrypted.bin', 'wb') as f:
    f.write(encrypted_fw)

print(f"Encryption complete, original size: {len(fw_data)}, encrypted: {len(encrypted_fw)}")
```

#### 6.3.2 Firmware Decryption (STM32 Side)

```c
// aes_decrypt.c - Using STM32 hardware AES accelerator
#include "stm32g4xx_hal.h"

// Key stored in Flash protected region (set read protection RDP Level 1)
const uint8_t AES_KEY[32] __attribute__((section(".key_section"))) = {
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF
};

CRYP_HandleTypeDef hcryp;

bool AES_DecryptFirmware(uint8_t *encrypted_data, uint32_t size, uint8_t *output) {
    // Extract IV (first 16 bytes)
    uint8_t iv[16];
    memcpy(iv, encrypted_data, 16);
    
    // Configure AES
    hcryp.Instance = AES;
    hcryp.Init.DataType = CRYP_DATATYPE_8B;
    hcryp.Init.KeySize = CRYP_KEYSIZE_256B;
    hcryp.Init.pKey = (uint32_t*)AES_KEY;
    hcryp.Init.pInitVect = (uint32_t*)iv;
    hcryp.Init.Algorithm = CRYP_AES_CBC;
    
    HAL_CRYP_Init(&hcryp);
    
    // Decrypt (skip first 16 bytes IV)
    if (HAL_CRYP_Decrypt(&hcryp, (uint32_t*)(encrypted_data + 16), 
                         size - 16, (uint32_t*)output, 5000) != HAL_OK) {
        return false;
    }
    
    // Remove padding
    uint8_t pad_len = output[size - 16 - 1];
    // Actual firmware size = decrypted size - padding length
    
    return true;
}

// Decrypt first during OTA, then write to Flash
void HandleEncryptedData(uint8_t *data, uint16_t len) {
    static uint8_t decrypt_buffer[1024];
    
    // Decrypt
    if (!AES_DecryptFirmware(data, len, decrypt_buffer)) {
        SendNACK(ERR_DECRYPT_FAIL);
        return;
    }
    
    // Write to Flash
    Flash_Write(g_ota.target_addr, decrypt_buffer, len - 16);
    g_ota.target_addr += (len - 16);
}
```

### 6.4 RSA Signature Verification (Anti-Tampering)

RSA signatures ensure firmware comes from a trusted source and has not been tampered with.

#### 6.4.1 Generate Key Pair (One-Time Operation)

```bash
# Generate 2048-bit RSA private key (keep secret on server)
openssl genrsa -out private_key.pem 2048

# Extract public key (burn into device)
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

#### 6.4.2 Firmware Signing (Server Side)

```python
# sign_firmware.py
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256

def sign_firmware(fw_data, private_key_path):
    # Read private key
    with open(private_key_path, 'rb') as f:
        private_key = RSA.import_key(f.read())
    
    # Calculate firmware SHA256
    h = SHA256.new(fw_data)
    
    # RSA signature
    signature = pkcs1_15.new(private_key).sign(h)
    
    return signature

# Usage example
with open('app.bin', 'rb') as f:
    fw_data = f.read()

signature = sign_firmware(fw_data, 'private_key.pem')

# Firmware package format: firmware + signature (256 bytes)
with open('app_signed.bin', 'wb') as f:
    f.write(fw_data)
    f.write(signature)
```

#### 6.4.3 Signature Verification (STM32 Side)

```c
// rsa_verify.c - Verify signature using mbedTLS library
#include "mbedtls/rsa.h"
#include "mbedtls/sha256.h"

// Public key (extracted from public_key.pem, burned into device)
const uint8_t RSA_PUBLIC_KEY_N[256] = { /* Public key modulus N */ };
const uint8_t RSA_PUBLIC_KEY_E[3] = {0x01, 0x00, 0x01};  // E=65537

bool RSA_VerifySignature(uint8_t *fw_data, uint32_t fw_size, uint8_t *signature) {
    mbedtls_rsa_context rsa;
    mbedtls_rsa_init(&rsa, MBEDTLS_RSA_PKCS_V15, 0);
    
    // Set public key
    rsa.len = 256;
    mbedtls_mpi_read_binary(&rsa.N, RSA_PUBLIC_KEY_N, 256);
    mbedtls_mpi_read_binary(&rsa.E, RSA_PUBLIC_KEY_E, 3);
    
    // Calculate firmware SHA256
    uint8_t hash[32];
    mbedtls_sha256(fw_data, fw_size, hash, 0);
    
    // Verify signature
    int ret = mbedtls_rsa_pkcs1_verify(&rsa, NULL, NULL, MBEDTLS_RSA_PUBLIC,
                                       MBEDTLS_MD_SHA256, 32, hash, signature);
    
    mbedtls_rsa_free(&rsa);
    
    return (ret == 0);
}

// Verify after receiving complete firmware
void HandleVerifyWithSignature(void) {
    // Firmware in App B region, signature in last 256 bytes
    uint8_t *fw_data = (uint8_t*)APP_B_ADDR;
    uint32_t fw_size = g_ota.fw_size - 256;
    uint8_t *signature = (uint8_t*)(APP_B_ADDR + fw_size);
    
    if (!RSA_VerifySignature(fw_data, fw_size, signature)) {
        SendNACK(ERR_SIGNATURE_FAIL);
        return;
    }
    
    // Signature passed, continue CRC check
    uint32_t crc = CRC32_Calculate(fw_data, fw_size);
    if (crc != g_ota.fw_crc) {
        SendNACK(ERR_CRC);
        return;
    }
    
    // Update parameters and switch partition
    UpdateBootParams();
    SendACK(NULL, 0);
}
```

### 6.5 Secure Boot

Prevent attacks during the boot process.

```c
// secure_boot.c - Secure boot flow
void SecureBoot_Verify(uint32_t app_addr) {
    // 1. Read firmware signature (stored at end of firmware)
    uint32_t fw_size = GetFirmwareSize(app_addr);
    uint8_t *signature = (uint8_t*)(app_addr + fw_size - 256);
    
    // 2. Verify RSA signature
    if (!RSA_VerifySignature((uint8_t*)app_addr, fw_size - 256, signature)) {
        // Signature verification failed, refuse to boot
        Error_Handler("Invalid Signature!");
        return;
    }
    
    // 3. Check version number (prevent rollback attack)
    uint32_t current_version = *(uint32_t*)(app_addr + 0x200);  // Version in firmware header
    if (current_version < g_boot_params.min_version) {
        Error_Handler("Version Rollback Detected!");
        return;
    }
    
    // 4. Check hardware version compatibility
    uint8_t hw_version = *(uint8_t*)(app_addr + 0x204);
    if (hw_version != GetHardwareVersion()) {
        Error_Handler("Hardware Mismatch!");
        return;
    }
    
    // 5. All checks passed, jump to application
    JumpToApplication(app_addr);
}
```

---

## 7. Exception Handling and Fault Tolerance

> Goal: ensure recovery no matter what goes wrong during OTA upgrade.

### 7.1 Common Exception Scenarios

| Exception scenario | Stage | Consequence | Recovery |
|---------|---------|------|---------|
| Transfer interrupted | Data reception | Incomplete firmware | Resume from breakpoint |
| Power loss | Flash write | New firmware corrupted | Roll back to old firmware |
| CRC check failed | End of upgrade | Firmware corrupted | Refuse switch, keep old firmware |
| New firmware crash | After boot | Infinite reboot | Boot count detection, auto rollback |
| Flash erase failed | Preparation | Cannot write | Mark bad block, try other region |

### 7.2 Resume from Breakpoint Implementation

After transfer interruption, resume from breakpoint without retransmitting.

### 7.3 Boot Count Detection

Prevent bad firmware causing infinite reboot.

### 7.4 Watchdog Protection

Automatic reboot if upgrade process times out.

---

## 8. Complete Project Walkthrough

### 8.1 Project Structure

A complete OTA system includes:
- Bootloader project (32KB)
- Application project (240KB)
- Python host PC tool

### 8.2 Key Steps

1. Modify linker script to set start address
2. Application's SystemInit sets VTOR offset
3. Implement Flash read/write and verification functions
4. Write communication protocol handler
5. Develop host PC upgrade tool

---

## 9. Summary and Best Practices

### 9.1 OTA System Checklist

- ✅ Dual application region design, ensure rollback capability
- ✅ CRC32 + RSA signature dual verification
- ✅ Resume from breakpoint + boot count detection
- ✅ Firmware encryption + secure boot
- ✅ Log upgrade process
- ✅ Watchdog protection against deadlock
- ✅ Version management against rollback

### 9.2 Common Issues

| Issue | Cause | Solution |
|------|------|---------|
| HardFault after jump | VTOR not set | Check Application's SystemInit |
| Flash write failed | Not aligned/not erased | Check address alignment and erase operation |
| CRC check failed | Data corrupted | Unify CRC algorithm |
| Infinite reboot | New firmware has bug | Enable boot count auto rollback |

### 9.3 Performance Optimization

1. Use DMA transfer to reduce CPU usage
2. Hardware CRC acceleration is 10x faster than software
3. Flash parallel erase while receiving
4. Compress firmware to reduce 50% transfer time
5. Resume from breakpoint—no retransmit after network interruption

---

**Learning path review**:
```
Understand boot flow → Flash partition design → Write Bootloader → 
Flash operations → Communication protocol → Firmware verification → Encryption & security → 
Exception handling → Complete project walkthrough
```

Through this guide, you have mastered the complete STM32 OTA upgrade technology stack!

**References**:
- AN2606: STM32 system memory boot mode
- AN4657: STM32 in-application programming
- UM2552: STM32Cube MCU Package examples
- NIST FIPS 197: Advanced Encryption Standard



Thanks for reading — see you in the next post.



**Last updated: July 13, 2026 20:02:35**
