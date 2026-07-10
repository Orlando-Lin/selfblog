---
title: STM32 Boot Flow
description: A detailed walkthrough of what happens on an STM32 from power-on through reset, startup, and application execution.
date: 2026-07-10
category: Tech
tags: [bootloader, Embedded, Software, STM32, OTA, Learning]
cover: https://assets.virongx.com/blog/covers/STM32_bootloader.png
---

> Boot flow in essence: hardware reset → boot mode selection → startup file execution → system init → application execution.

# Full STM32 Boot Sequence

> After STM32 power-on:
>
> 1. POR/BOR confirms stable supply and releases reset.
> 2. BootROM reads BOOT0, Option Bytes, and other boot config to pick the boot source.
> 3. BootROM maps the selected memory to the boot address (0x00000000).
> 4. The CPU reads the initial MSP and Reset_Handler address from the boot address.
> 5. It jumps to Reset_Handler and runs user code (or ST’s system bootloader).

## 1 Hardware Power-On and Reset

> Controlled by hardware circuits and on-chip logic.

### 1.1 Power-On and Reset Trigger

**Power-on**: As VDD rises, POR/BOR circuits monitor whether voltage crosses the threshold (yes: internal reset releases; no: MCU stays in reset). When reset releases, the system starts.

**Reset button**: When NRST (normally high) is driven low, the chip enters reset—all registers return to defaults. When the button releases, the system starts.

### 1.2 Reading the Boot Address

**F1 series**: Reads BOOT0 (and BOOT1 on some parts) to decide the boot source.

| BOOT1 | BOOT0 | Boot mode              | Boot address |
| :---- | :---- | :--------------------- | :----------- |
| 0     | 0     | Flash (typical)        | 0x08000000   |
| 0     | 1     | System memory (ISP)    | 0x1FFFF000   |
| 1     | 1     | SRAM (debug)           | 0x20000000   |

> The CPU first accesses 0x00000000, which is **aliased** in hardware to the regions above.

**F4/F7 series**: No classic BOOT1 pin; boot is decided by **BOOT0 plus Option Bytes**.

Flow: reset circuit → CPU runs BootROM → BootROM reads boot config → Flash / System Memory / SRAM

<u>Where are Option Bytes and how do you configure them?</u>

> Option Bytes are a **<u>special config region in Flash</u>** holding permanent settings for boot, security, and read/write protection.

They belong to the Flash controller (FLASH). The CPU usually does not read them directly—BootROM reads them via the FLASH controller.

Configure with STM32CubeProgrammer / CubeMX (partial support; generated code does not directly change Option Bytes on-chip). You can also change them via HAL APIs.

On H7, Option Bytes can configure boot, BOR level, RDP, WRP, PCROP, IWDG, dual-bank boot, boot address, security, and more.

### 1.3 Choosing the Boot Source

**User Flash boot**: BootROM hands control to your program.

Flash base is typically 0x08000000. The first content is not C code—it is the **vector table**.

**System Memory (ST factory bootloader)**: BootROM runs code ST burned into System Memory, supporting many download protocols.

After entering System Memory, the host sends a HEX file, programs Flash, then reset boots from Flash again.

Link: [Introduction to system memory boot mode on STM32 MCUs - Application note](https://www.st.com/resource/en/application_note/cd00167594-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf)

> Useful when Flash is empty and there is no application yet.

**SRAM boot (debug)**: BootROM jumps to SRAM (program must already be in SRAM).

Example: SRAM 0x20000000 → vector table → program.

Used mainly for debug: IDE downloads to SRAM and runs immediately without erasing Flash. If Flash is bad, you can run from SRAM to test Flash, cache, SRAM, or CPU.

Link: [Getting started with STM32F4xxxx MCU hardware development - Application note](https://www.st.com/resource/en/application_note/dm00115714.pdf)

### 1.4 Jump to Reset_Handler

Boot source is fixed; next step is reading the **vector table**:

| Address    | Content              |
| ---------- | -------------------- |
| 0x08000000 | Initial MSP          |
| 0x08000004 | Reset_Handler addr   |
| 0x08000008 | NMI_Handler          |
| 0x0800000C | HardFault_Handler    |
| .....      | MemManage_Handler    |

The CPU first loads MSP from *(0x08000000).

> Functions need a stack for PUSH/POP and register saves; without a valid stack the CPU cannot run C code normally.

Then it loads Reset_Handler from *(0x08000004) and executes the first user instruction.

## 2 Startup File Execution

We are now in Reset_Handler, defined in `startup_xxxxx.s`:

```asm
Reset_Handler    PROC
                 EXPORT  Reset_Handler             [WEAK]
        IMPORT  SystemInit
        IMPORT  __main

                 LDR     R0, =SystemInit	# R0 = &SystemInit
                 BLX     R0					# SystemInit();
                 LDR     R0, =__main		# R0 = __main
                 BX      R0					# jump to __main
                 ENDP
```

> Defines Reset_Handler; the linker places its address in vector entry 2.
>
> Imports SystemInit from `system_stmxxxx.c` and __main from Keil runtime.
>
> Then execution really begins.

SystemInit (CMSIS) initializes the chip: cache, MPU, clocks, VTOR, FPU, external RAM, etc. Peripherals are initialized later in `main()`.

> [!CAUTION]
>
> __main is not main()!

In Keil (ARM Compiler), __main comes from the ARM runtime library: copy `.data` from Flash to RAM, zero `.bss`, init the C library, call C++ constructors, then call `main()`. GCC splits this work differently in its startup.

---

## 3 Deep Dive: STM32G4 Example

### 3.1 STM32G4 Boot Configuration

Modern G4 parts use **nBOOT0** and **nSWBOOT0** in Option Bytes instead of classic BOOT0/BOOT1 combos.

#### 3.1.1 Boot Mode Selection

| nSWBOOT0 | nBOOT0 | Physical BOOT0 | Actual boot source        |
| -------- | ------ | -------------- | ------------------------- |
| 1        | x      | x              | Decided by nBOOT0         |
| 0        | x      | 0              | System Memory             |
| 0        | x      | 1              | Decided by nBOOT0         |

When nSWBOOT0=1, the BOOT0 pin is ignored:
- nBOOT0=1: boot from Flash (0x08000000)
- nBOOT0=0: boot from System Memory (0x1FFF0000)

#### 3.1.2 Key Option Byte Bits

Option Bytes sit in a special Flash region (0x1FFF7800 on G4).

**FLASH_OPTR register:**

```c
// Boot-related bits
#define FLASH_OPTR_nBOOT0_Pos       (27U)
#define FLASH_OPTR_nBOOT0_Msk       (0x1UL << FLASH_OPTR_nBOOT0_Pos)
#define FLASH_OPTR_nSWBOOT0_Pos     (26U)
#define FLASH_OPTR_nSWBOOT0_Msk     (0x1UL << FLASH_OPTR_nSWBOOT0_Pos)

// BOR level
#define FLASH_OPTR_BOR_LEV_Pos      (8U)
#define FLASH_OPTR_BOR_LEV_Msk      (0x7UL << FLASH_OPTR_BOR_LEV_Pos)
// BOR_LEV=0: 1.7V, 1: 2.0V, 2: 2.2V, 3: 2.5V

// Read protection
#define FLASH_OPTR_RDP_Pos          (0U)
#define FLASH_OPTR_RDP_Msk          (0xFFUL << FLASH_OPTR_RDP_Pos)
// RDP=0xAA: none, other: Level 1, RDP=0xCC: Level 2 (irreversible)
```

### 3.2 Power-On Reset Sequence

#### 3.2.1 POR Sequence

STM32G4 integrates POR and BOR:

```
VDD rises → POR monitors
    ↓
VDD < Vmin(POR) → MCU held in reset
    ↓
VDD ≥ VPOR (~1.8V typ.) → POR releases
    ↓
VDD ≥ VBOR (from Option Bytes) → BOR releases
    ↓
HSI starts (16 MHz) → initial clock
    ↓
Reset released → BootROM runs
```

**Timing (G4 datasheet):**
- tRSTTEMPO: ~4.5 ms typ. from stable power to reset release
- VPOR: 1.62V ~ 2.0V
- VBOR: 1.7V / 2.0V / 2.2V / 2.5V configurable

#### 3.2.2 BootROM Flow

BootROM is in internal ROM (immutable). Pseudocode:

```c
void BootROM_Entry(void) {
    uint32_t optr = READ_REG(FLASH->OPTR);
    bool nSWBOOT0 = (optr & FLASH_OPTR_nSWBOOT0_Msk) >> FLASH_OPTR_nSWBOOT0_Pos;
    bool nBOOT0 = (optr & FLASH_OPTR_nBOOT0_Msk) >> FLASH_OPTR_nBOOT0_Pos;
    bool boot0_pin = READ_PIN(BOOT0);
    
    uint32_t boot_address;
    
    if (nSWBOOT0) {
        boot_address = nBOOT0 ? 0x08000000 : 0x1FFF0000;
    } else {
        boot_address = boot0_pin ? 0x08000000 : 0x1FFF0000;
    }
    
    SYSCFG->MEMRMP = (boot_address == 0x08000000) ? 0x00 : 0x01;
    
    uint32_t msp = *(volatile uint32_t*)(boot_address);
    uint32_t reset_handler = *(volatile uint32_t*)(boot_address + 4);
    
    __set_MSP(msp);
    void (*reset_func)(void) = (void(*)(void))reset_handler;
    reset_func();
}
```

### 3.3 Startup File: startup_stm32g4xxxx.s

#### 3.3.1 Vector Table

```asm
; startup_stm32g431xx.s (excerpt)
                PRESERVE8
                THUMB

                AREA    RESET, DATA, READONLY
                EXPORT  __Vectors

__Vectors       DCD     __initial_sp              ; Top of Stack
                DCD     Reset_Handler
                DCD     NMI_Handler
                DCD     HardFault_Handler
                ; ... 90+ external IRQ vectors
```

- `__initial_sp`: from linker script, often end of SRAM
- Each `DCD` is 4 bytes
- Vector table must be aligned (G4: at least 128 bytes)

#### 3.3.2 Reset_Handler

```asm
Reset_Handler   PROC
                EXPORT  Reset_Handler             [WEAK]
                IMPORT  SystemInit
                IMPORT  __main

                LDR     R0, =SystemInit
                BLX     R0
                LDR     R0, =__main
                BX      R0
                ENDP
```

### 3.4 SystemInit()

```c
void SystemInit(void)
{
#if (__FPU_PRESENT == 1) && (__FPU_USED == 1)
    SCB->CPACR |= ((3UL << 10*2)|(3UL << 11*2));
#endif

#ifdef VECT_TAB_SRAM
    SCB->VTOR = SRAM_BASE | VECT_TAB_OFFSET;
#else
    SCB->VTOR = FLASH_BASE | VECT_TAB_OFFSET;
#endif

    /* Default HSI 16 MHz; PLL in main() via HAL_RCC_OscConfig() */
}
```

**VTOR for Bootloader + App:**

```c
SCB->VTOR = 0x08008000;  // App vector table offset
```

### 3.5 From __main to main()

Keil __main (pseudocode): copy `.data`, zero `.bss`, `__rt_lib_init()`, C++ ctors, `main()`, `exit()`.

GCC startup does the same steps in assembly before `bl main`.

### 3.6 Full Boot Timeline

```
Power-on
 │
 ├─> [HW] POR/BOR release, tRSTTEMPO (~4.5ms)
 ├─> [BootROM] Read OPTR, pick boot source, map memory, load MSP, jump
 ├─> [startup.s] Reset_Handler → SystemInit → __main
 ├─> [Runtime] .data/.bss, C lib init → main()
 └─> [App] HAL_Init(), clock, peripherals, main loop
```

### 3.7 Memory Layout (STM32G431)

Flash: vector table → `.text` → `.rodata` → `.data` init values.

RAM: `.data` → `.bss` → heap ↓ ↑ stack → `__initial_sp` at RAM top.

### 3.8 Bootloader Dual-Region Example

```
0x08000000  Bootloader (32KB)
0x08008000  Application (240KB)
0x08044000  Download area (240KB)
```

Jump to App:

```c
#define APP_ADDRESS     0x08008000

void JumpToApplication(void) {
    uint32_t app_stack = *(volatile uint32_t*)APP_ADDRESS;
    uint32_t app_entry = *(volatile uint32_t*)(APP_ADDRESS + 4);
    
    if ((app_stack & 0x2FFE0000) != 0x20000000) return;
    
    HAL_RCC_DeInit();
    HAL_DeInit();
    SysTick->CTRL = 0;
    
    for (uint8_t i = 0; i < 8; i++) {
        NVIC->ICER[i] = 0xFFFFFFFF;
        NVIC->ICPR[i] = 0xFFFFFFFF;
    }
    
    SCB->VTOR = APP_ADDRESS;
    __set_MSP(app_stack);
    
    void (*app_reset_handler)(void) = (void(*)(void))app_entry;
    app_reset_handler();
    while(1);
}
```

App `SystemInit`:

```c
#define VECT_TAB_OFFSET  0x8000

void SystemInit(void) {
    SCB->VTOR = FLASH_BASE + VECT_TAB_OFFSET;
}
```

### 3.9 Debug Tips

Inspect in `main()`:

```c
volatile uint32_t vtor = SCB->VTOR;
volatile uint32_t msp = __get_MSP();
```

Use STM32CubeProgrammer → Option Bytes for nBOOT0, RDP, BOR.

| Symptom | Possible cause | Check |
|---------|----------------|-------|
| No run after power-on | VDD/BOR, crystal | Measure VDD, scope OSC |
| App dead | Bad vector table | 0x08000000 should be 0x2000xxxx |
| Debugger fails | RDP, SWD conflict | ISP from System Memory |
| Bootloader jump fails | IRQ/peripherals, VTOR | Deinit + set VTOR in App |

---

## 4 Summary

```
Hardware reset → BootROM → boot source → vector table → Reset_Handler
   → SystemInit() → C runtime → main()
```

**Takeaways:**
- Modern parts use Option Bytes for flexible boot
- 0x00000000 aliases Flash / System Memory / SRAM
- Vector table word 0 = MSP, word 1 = Reset_Handler
- Bootloader jumps require deinit, IRQ off, VTOR relocate

**Further reading:** Secure Boot, dual-bank, low-power wake, disabling SWD in production.

---

**References:**
- STM32G4 Reference Manual (RM0440)
- STM32G4 Datasheet
- Cortex-M4 Technical Reference Manual (ARM DDI 0439)
- AN2606: STM32 system memory boot mode
- AN4894: EEPROM emulation on STM32

Thanks for reading — see you in the next post.

**Last updated: July 10, 2026 10:35:35**
