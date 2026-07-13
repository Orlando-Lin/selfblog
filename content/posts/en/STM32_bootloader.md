---
title: STM32 Boot Flow
description: A detailed explanation of what happens on an STM32 after power-on.
date: 2026-07-10
category: Tech
tags: [bootloader, Embedded, Software, STM32, OTA, Learning]
cover: https://assets.virongx.com/blog/covers/STM32_bootloader.png
---

> Boot flow in essence: hardware reset → boot mode selection → startup file execution → system initialization → application execution.

# Full STM32 Boot Sequence

> After STM32 power-on:
>
> 1. POR/BOR confirms stable supply and releases reset.
> 2. BootROM reads BOOT0, Option Bytes, and other boot configuration to determine the boot source.
> 3. BootROM maps the corresponding memory to the boot address (0x00000000).
> 4. The CPU reads the initial MSP and Reset_Handler address from the boot address.
> 5. It jumps to Reset_Handler and begins executing user code (or the system Bootloader).

## Contents

- [1 Hardware Power-On and Reset](#1-hardware-power-on-and-reset)
- [2 Executing the Startup File](#2-executing-the-startup-file)
- [3 Deep Dive: STM32G4 Series Example](#3-deep-dive-stm32g4-series-example)
- [4 Summary](#4-summary)

## 1 Hardware Power-On and Reset

> Controlled by hardware circuits and on-chip logic.

### 1.1 Power-On and Reset Trigger

Power-on: As VDD rises, the POR/BOR reset circuit starts working and checks whether voltage has reached the threshold (yes: internal reset releases; no: the MCU stays in reset). When reset releases, the system starts.

Reset button: When the reset signal is active (NRST pin is normally high; low level triggers reset), the chip enters reset—all registers return to default values. When the button releases, the system starts.

### 1.2 Reading the Boot Address

**F1 series**: Reads BOOT0 (and BOOT1 on some series) to decide the boot source.

| BOOT1 | BOOT0 | Boot mode                  | Boot address |
| :---- | :---- | :------------------------- | :----------- |
| 0     | 0     | Flash boot (typical)       | 0x08000000   |
| 0     | 1     | System memory (ISP download) | 0x1FFFF000 |
| 1     | 1     | SRAM boot (debug)          | 0x20000000   |

> The CPU first accesses: 0x00000000
>
> This address is hardware-mapped (aliased) to different regions (boot addresses in the table above)

**F4/F7 series**: There is no longer a BOOT1 pin in the traditional sense; boot mode is mainly determined by **the BOOT0 pin and Option Bytes (boot configuration)** together.

Flow: reset circuit → CPU starts executing BootROM → BootROM reads boot configuration → decides Flash / System Memory / SRAM boot

Option Bytes keep coming up—where are they and how do you configure them?

> Option Bytes are a **special configuration region in STM32 Flash**, used to store permanent settings for chip boot, security, and read/write protection.

They fall under the Flash Controller (FLASH); the CPU generally does not read Option Bytes directly. Instead, BootROM reads them through the FLASH controller.

You can configure them via STM32CubeProgrammer/CubeMX (partially supported; generated code does not directly modify the chip's Option Bytes); you can also modify them using HAL interfaces.

Taking H7 as an example, Option Bytes can configure: boot configuration / BOR level / RDP level / WRP write protection / PCROP read protection / IWDG configuration / dual-bank boot / boot address / security configuration.

### 1.3 Determining the Boot Source

**User Flash boot**: BootROM hands control to your program

For STM32, the Flash base address is usually 0x08000000. What sits here is not C code, but the **interrupt vector table (Vector Table)**.

**System Memory (enter ST official Bootloader):** BootROM goes directly to System Memory and runs the Bootloader burned in at the factory by ST. It resides in System Memory and supports many download protocols.

After entering System Memory, it waits for the PC to send a HEX file, programs Flash, then resets and boots from Flash again.

[Introduction to system memory boot mode on STM32 MCUs - Application note](https://www.st.com/resource/en/application_note/cd00167594-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf)

> When Flash has been erased empty with no program, you can use it this way

**SRAM boot (debug mode):** BootROM goes directly to SRAM (the program must already exist in SRAM).

For example: SRAM 0x20000000 → Vector Table → program.

This mode is mainly for debugging—the IDE downloads directly to SRAM and runs immediately without erasing Flash. If Flash is bad, you can download a program to SRAM to check Flash, or test Cache/SRAM/CPU.

[Getting started with STM32F4xxxx MCU hardware development - Application note](https://www.st.com/resource/en/application_note/dm00115714.pdf)

### 1.4 Jump to Reset_Handler

The boot source is now confirmed; next, read the Vector Table (interrupt vector table)

The beginning of Flash actually looks like this:

| Address    | Content              |
| ---------- | -------------------- |
| 0x08000000 | Initial MSP (main stack pointer) |
| 0x08000004 | Reset_Handler address |
| 0x08000008 | NMI_Handler          |
| 0x0800000C | HardFault_Handler    |
| .....      | MemManage_Handler    |

At this point the first thing the CPU does is read MSP *(0x08000000)

> Because functions are about to execute—PUSH/POP, saving registers, etc.—all of that needs a Stack; without a stack the CPU cannot execute functions normally.

Then it continues reading Reset_Handler *(0x08000004); the value at this address is Reset_Handler.

Then the first real user code starts executing!

## 2 Executing the Startup File

The previous section already entered Reset_Handler, and Reset_Handler is in startup_xxxxx.s

```asm
Reset_Handler    PROC
                 EXPORT  Reset_Handler             [WEAK]
        IMPORT  SystemInit
        IMPORT  __main

                 LDR     R0, =SystemInit	# R0 = &SystemInit
                 BLX     R0					# SystemInit();
                 LDR     R0, =__main		#R0 = __main
                 BX      R0					# jump to __main
                 ENDP
```

> First a function Reset_Handler() is defined; when the CPU jumps here it starts executing the function body below
>
> Declares a global symbol Reset_Handler, telling the linker (the second entry in the interrupt vector table points to it)—this is actually the Reset_Handler address.
>
> Lines three and four indicate two functions in other files: system_stmxxxx.c → SystemInit(), Keil Runtime → __main.
>
> Only after that does real execution begin;

SystemInit() is a CMSIS-provided function that initializes the entire chip—it configures Cache, MPU, clocks, VTOR, enables FPU, initializes external RAM, etc. Peripherals are not initialized at this point; that happens in main().

> [!CAUTION]
>
> __main is not main();

In Keil (ARM Compiler), __main is not written by you—it comes from the ARM Runtime Library. This function is responsible for initializing RAM (copy .data: copy Flash parameters to RAM → zero .bss: int b; per the C standard b=0, the startup file does memset() to zero everything, otherwise RAM is full of garbage) → initialize global variables (initialize C library → call constructors) → main()

This differs from GCC startup—GCC has no __main because GCC splits this work apart.

---

## 3 Deep Dive: STM32G4 Series Example

### 3.1 STM32G4 Boot Configuration in Detail

The STM32G4 series uses a modern boot configuration mechanism. It no longer uses the traditional BOOT0/BOOT1 pin combination; instead, **the nBOOT0 bit (Option Bytes)** and **the nSWBOOT0 bit (Option Bytes)** together determine boot mode.

#### 3.1.1 Boot Mode Selection Mechanism

The STM32G4 boot source is determined by the following factors:

| nSWBOOT0 | nBOOT0 | Physical BOOT0 pin | Actual boot source        |
| -------- | ------ | ------------------ | ------------------------- |
| 1        | x      | x                  | Determined by nBOOT0 bit  |
| 0        | x      | 0                  | System Memory             |
| 0        | x      | 1                  | Determined by nBOOT0 bit  |

When nSWBOOT0=1, the physical BOOT0 pin is ignored and nBOOT0 fully controls boot:
- nBOOT0=1: boot from Flash (0x08000000)
- nBOOT0=0: boot from System Memory (0x1FFF0000)

#### 3.1.2 Key Option Bytes Configuration Bits

STM32G4 Option Bytes sit in a special Flash region (0x1FFF7800). Key configuration includes:

**FLASH_OPTR register (Option Byte Register):**

```c
// Boot configuration related bits
#define FLASH_OPTR_nBOOT0_Pos       (27U)
#define FLASH_OPTR_nBOOT0_Msk       (0x1UL << FLASH_OPTR_nBOOT0_Pos)
#define FLASH_OPTR_nSWBOOT0_Pos     (26U)
#define FLASH_OPTR_nSWBOOT0_Msk     (0x1UL << FLASH_OPTR_nSWBOOT0_Pos)

// BOR level configuration (brown-out reset threshold)
#define FLASH_OPTR_BOR_LEV_Pos      (8U)
#define FLASH_OPTR_BOR_LEV_Msk      (0x7UL << FLASH_OPTR_BOR_LEV_Pos)
// BOR_LEV=0: 1.7V, BOR_LEV=1: 2.0V, BOR_LEV=2: 2.2V, BOR_LEV=3: 2.5V

// Read protection level
#define FLASH_OPTR_RDP_Pos          (0U)
#define FLASH_OPTR_RDP_Msk          (0xFFUL << FLASH_OPTR_RDP_Pos)
// RDP=0xAA: no protection, RDP=other: Level 1, RDP=0xCC: Level 2 (irreversible)
```

### 3.2 Power-On Reset Flow in Detail

#### 3.2.1 Power-On Sequence (POR)

STM32G4 integrates POR (Power-On Reset) and BOR (Brown-Out Reset) circuits internally:

```
VDD rises → POR circuit monitors
    ↓
VDD < Vmin(POR) → MCU stays in reset
    ↓
VDD ≥ VPOR (1.8V typical) → POR releases
    ↓
VDD ≥ VBOR (per Option Bytes config) → BOR releases
    ↓
Internal RC oscillator (HSI) starts → provides initial clock (16MHz)
    ↓
Reset releases, BootROM execution begins
```

**Timing parameters (STM32G4 datasheet):**
- tRSTTEMPO: delay from stable power to reset release, typical 4.5ms
- VPOR: 1.62V ~ 2.0V (depends on temperature and voltage range)
- VBOR: configurable as 1.7V/2.0V/2.2V/2.5V

#### 3.2.2 BootROM Execution Flow

STM32G4 BootROM resides in the chip's internal ROM region (cannot be modified). After reset the CPU first executes BootROM code:

```c
// BootROM pseudocode flow
void BootROM_Entry(void) {
    // 1. Read Option Bytes configuration
    uint32_t optr = READ_REG(FLASH->OPTR);
    bool nSWBOOT0 = (optr & FLASH_OPTR_nSWBOOT0_Msk) >> FLASH_OPTR_nSWBOOT0_Pos;
    bool nBOOT0 = (optr & FLASH_OPTR_nBOOT0_Msk) >> FLASH_OPTR_nBOOT0_Pos;
    bool boot0_pin = READ_PIN(BOOT0);
    
    uint32_t boot_address;
    
    // 2. Determine boot source
    if (nSWBOOT0) {
        // Determined by Option Bytes
        boot_address = nBOOT0 ? 0x08000000 : 0x1FFF0000;
    } else {
        // Determined by physical pin
        boot_address = boot0_pin ? 0x08000000 : 0x1FFF0000;
    }
    
    // 3. Configure memory mapping (map boot source to 0x00000000)
    SYSCFG->MEMRMP = (boot_address == 0x08000000) ? 0x00 : 0x01;
    
    // 4. Read stack pointer and reset vector from boot address
    uint32_t msp = *(volatile uint32_t*)(boot_address);
    uint32_t reset_handler = *(volatile uint32_t*)(boot_address + 4);
    
    // 5. Set stack pointer and jump
    __set_MSP(msp);
    void (*reset_func)(void) = (void(*)(void))reset_handler;
    reset_func();  // Jump to Reset_Handler
}
```

### 3.3 Startup File in Detail: startup_stm32g4xxxx.s

#### 3.3.1 Interrupt Vector Table Structure

The STM32G4 startup file defines the complete interrupt vector table:

```asm
; startup_stm32g431xx.s excerpt
                PRESERVE8
                THUMB

; Vector Table Mapped to Address 0 at Reset
                AREA    RESET, DATA, READONLY
                EXPORT  __Vectors
                EXPORT  __Vectors_End
                EXPORT  __Vectors_Size

__Vectors       DCD     __initial_sp              ; Top of Stack (0x08000000)
                DCD     Reset_Handler             ; Reset Handler (0x08000004)
                DCD     NMI_Handler               ; NMI Handler
                DCD     HardFault_Handler         ; Hard Fault Handler
                DCD     MemManage_Handler         ; MPU Fault Handler
                DCD     BusFault_Handler          ; Bus Fault Handler
                DCD     UsageFault_Handler        ; Usage Fault Handler
                DCD     0                         ; Reserved
                DCD     0                         ; Reserved
                DCD     0                         ; Reserved
                DCD     0                         ; Reserved
                DCD     SVC_Handler               ; SVCall Handler
                DCD     DebugMon_Handler          ; Debug Monitor Handler
                DCD     0                         ; Reserved
                DCD     PendSV_Handler            ; PendSV Handler
                DCD     SysTick_Handler           ; SysTick Handler
                
                ; External Interrupts (STM32G4-specific peripherals)
                DCD     WWDG_IRQHandler           ; Window WatchDog
                DCD     PVD_PVM_IRQHandler        ; PVD/PVM through EXTI
                ; ... 90+ external interrupt vectors total
```

**Key points:**
- `__initial_sp`: computed by the linker script, usually points to the end of SRAM (e.g.: 0x20000000 + 128KB)
- Each DCD (Define Constant Data) occupies 4 bytes
- The vector table must be aligned to a multiple of its size (STM32G4 requires at least 128-byte alignment)

#### 3.3.2 Reset_Handler Execution Flow in Detail

```asm
Reset_Handler   PROC
                EXPORT  Reset_Handler             [WEAK]
                IMPORT  SystemInit
                IMPORT  __main

; ========== Step 1: Call SystemInit() ==========
                LDR     R0, =SystemInit
                BLX     R0
                
; ========== Step 2: Jump to C Runtime initialization ==========
                LDR     R0, =__main
                BX      R0
                ENDP
```

**Instruction breakdown:**
- `LDR R0, =SystemInit`: load SystemInit function address into R0
- `BLX R0`: branch with link and exchange—calls SystemInit and returns
- `BX R0`: jump to __main (no return)

### 3.4 SystemInit() Implementation in Detail

#### 3.4.1 SystemInit() in system_stm32g4xx.c

```c
// system_stm32g4xx.c
void SystemInit(void)
{
    /* FPU setup -----------------------------------------------------------*/
#if (__FPU_PRESENT == 1) && (__FPU_USED == 1)
    SCB->CPACR |= ((3UL << 10*2)|(3UL << 11*2));  
    // Enable CP10 and CP11 coprocessors (FPU)
    // CP10: bits[21:20] = 0b11, CP11: bits[23:22] = 0b11
#endif

    /* Configure Vector Table Offset Register VTOR -------------------------*/
#ifdef VECT_TAB_SRAM
    SCB->VTOR = SRAM_BASE | VECT_TAB_OFFSET; 
    // Set when booting from SRAM (debug mode)
#else
    SCB->VTOR = FLASH_BASE | VECT_TAB_OFFSET; 
    // Typically: FLASH_BASE=0x08000000, OFFSET=0x00
#endif

    /* Clock configuration --------------------------------------------------*/
    // After reset, HSI (16MHz internal RC oscillator) is used by default
    // User can call HAL_RCC_OscConfig() in main() to switch to HSE/PLL
    
    /* Do not initialize peripherals here! SystemInit() only handles basic chip-level config */
}
```

**Key configuration details:**

1. **FPU enable (Floating Point Unit):**
```c
// CPACR: Coprocessor Access Control Register
// bits[23:20]: CP10 and CP11 access permissions
// 0b00: access denied (default)
// 0b11: full access (privileged and unprivileged modes)
SCB->CPACR |= ((3UL << 20)|(3UL << 22));
```

2. **VTOR configuration (Vector Table Offset Register):**
```c
// STM32G4 allows vector table relocation (for Bootloader scenarios)
// Example: Bootloader at 0x08000000, App at 0x08008000
// App's SystemInit needs to set:
SCB->VTOR = 0x08008000;  // Relocate vector table to App start address
```

### 3.5 C Runtime Initialization: __main to main()

#### 3.5.1 Keil MDK-ARM __main Flow

```c
// ARM C Library internal implementation (pseudocode)
void __main(void) {
    // 1. Copy .data section (initialized data from Flash to RAM)
    extern uint32_t Image$$RW_IRAM1$$Base;      // .data start address in RAM
    extern uint32_t Load$$RW_IRAM1$$Base;       // .data load address in Flash
    extern uint32_t Image$$RW_IRAM1$$Length;    // .data section length
    
    memcpy(&Image$$RW_IRAM1$$Base, 
           &Load$$RW_IRAM1$$Base, 
           (size_t)&Image$$RW_IRAM1$$Length);
    
    // 2. Zero .bss section (uninitialized data)
    extern uint32_t Image$$RW_IRAM1$$ZI$$Base;
    extern uint32_t Image$$RW_IRAM1$$ZI$$Length;
    
    memset(&Image$$RW_IRAM1$$ZI$$Base, 0, 
           (size_t)&Image$$RW_IRAM1$$ZI$$Length);
    
    // 3. Initialize C standard library (if using printf etc.)
    __rt_lib_init();  // Initialize heap, semihosting, etc.
    
    // 4. Call C++ global object constructors (if using C++)
    __cpp_initialize__aeabi_();
    
    // 5. Jump to main()
    int result = main();
    
    // 6. Cleanup after main() returns (usually does not return)
    exit(result);
}
```

#### 3.5.2 GCC Toolchain Implementation (Comparison)

GCC startup files do this work directly in assembly:

```asm
Reset_Handler:
    ldr   r0, =_estack      /* Set stack pointer */
    mov   sp, r0

    /* Copy .data section */
    ldr r0, =_sdata         /* .data start address in RAM */
    ldr r1, =_edata         /* .data end address in RAM */
    ldr r2, =_sidata        /* .data load address in Flash */
    b LoopCopyDataInit

CopyDataInit:
    ldr r3, [r2], #4        /* Read 4 bytes from Flash */
    str r3, [r0], #4        /* Write to RAM */

LoopCopyDataInit:
    cmp r0, r1              /* Check if copy is complete */
    bcc CopyDataInit

    /* Zero .bss section */
    ldr r0, =_sbss
    ldr r1, =_ebss
    mov r2, #0
    b LoopFillZerobss

FillZerobss:
    str r2, [r0], #4

LoopFillZerobss:
    cmp r0, r1
    bcc FillZerobss

    /* Call SystemInit */
    bl SystemInit
    
    /* Call main */
    bl main
    
    /* If main returns, enter infinite loop */
    b .
```

### 3.6 Complete Boot Sequence Diagram

```
Power-on
 │
 ├─> [Hardware] VDD rises to VPOR → POR releases
 │
 ├─> [Hardware] VDD rises to VBOR → BOR releases → tRSTTEMPO delay (~4.5ms)
 │
 ├─> [BootROM] HSI starts (16MHz) → CPU begins executing BootROM
 │              │
 │              ├─> Read FLASH->OPTR (nSWBOOT0, nBOOT0, BOOT0 pin)
 │              ├─> Decide boot source: 0x08000000 (Flash) / 0x1FFF0000 (System Memory)
 │              ├─> Configure SYSCFG->MEMRMP (memory mapping)
 │              ├─> Read MSP: *(0x08000000) → set stack pointer
 │              └─> Read Reset_Handler: *(0x08000004) → jump
 │
 ├─> [startup.s] Reset_Handler executes
 │              │
 │              ├─> BLX SystemInit
 │              │      │
 │              │      ├─> Enable FPU (SCB->CPACR)
 │              │      ├─> Configure VTOR (SCB->VTOR = 0x08000000)
 │              │      └─> Return
 │              │
 │              └─> BX __main
 │
 ├─> [C Runtime] __main executes
 │              │
 │              ├─> Copy .data section (Flash → RAM)
 │              ├─> Zero .bss section (memset 0)
 │              ├─> Initialize C library (__rt_lib_init)
 │              ├─> C++ constructors (if any)
 │              └─> Call main()
 │
 └─> [User code] main() begins execution
               │
               ├─> HAL_Init() / LL_Init()
               ├─> SystemClock_Config()  // Configure PLL to 170MHz
               ├─> Peripheral initialization
               └─> while(1) { ... }      // Main loop
```

### 3.7 Key Memory Layout (STM32G431 Example)

#### 3.7.1 Flash Layout

```
0x0800 0000  ┌────────────────────────┐
             │  Interrupt vector table (512 bytes) │  __Vectors
0x0800 0200  ├────────────────────────┤
             │                        │
             │  .text (code section)  │  Reset_Handler, main(), all functions
             │                        │
             ├────────────────────────┤
             │  .rodata (read-only data) │  const variables, string literals
             ├────────────────────────┤
             │  .data initial values  │  Initial values of initialized globals
0x0807 FFFF  └────────────────────────┘  (512KB Flash end)
```

#### 3.7.2 RAM Layout

```
0x2000 0000  ┌────────────────────────┐
             │  .data (initialized data) │  Global variables copied from Flash
             ├────────────────────────┤
             │  .bss (uninitialized data) │  Variables like int a; (zeroed)
             ├────────────────────────┤
             │                        │
             │  Heap                  │  malloc/new dynamic allocation
             │         ↓              │
             │                        │
             │         ↑              │
             │  Stack                 │  Function calls, local variables
             │                        │
0x2001 FFFF  └────────────────────────┘  (__initial_sp points here, 128KB RAM end)
```

### 3.8 Common Bootloader Scenario: Dual-Region Boot

#### 3.8.1 Bootloader + Application Memory Allocation

```
Flash layout (512KB):
0x0800 0000  ┌────────────────────────┐
             │  Bootloader (32KB)     │  Handles OTA updates, jump to App
             │  - Vector Table        │
             │  - Bootloader Code     │
0x0800 8000  ├────────────────────────┤
             │  Application (240KB)   │  Actual application
             │  - App Vector Table    │
             │  - App Code            │
0x0804 4000  ├────────────────────────┤
             │  Download Area (240KB)   │  Stores OTA downloaded new firmware
0x0808 0000  └────────────────────────┘
```

#### 3.8.2 Bootloader Jump to App Code Example

```c
// bootloader.c - Jump to application
#define APP_ADDRESS     0x08008000  // Application start address

void JumpToApplication(void) {
    uint32_t app_stack = *(volatile uint32_t*)APP_ADDRESS;
    uint32_t app_entry = *(volatile uint32_t*)(APP_ADDRESS + 4);
    
    // 1. Check stack pointer validity (must be within RAM range)
    if ((app_stack & 0x2FFE0000) != 0x20000000) {
        return;  // Invalid stack address, abort jump
    }
    
    // 2. Shut down all peripherals and interrupts
    HAL_RCC_DeInit();           // Reset RCC to default state
    HAL_DeInit();               // Shut down peripherals used by HAL
    
    SysTick->CTRL = 0;          // Disable SysTick
    SysTick->LOAD = 0;
    SysTick->VAL = 0;
    
    // 3. Disable all interrupts
    for (uint8_t i = 0; i < 8; i++) {
        NVIC->ICER[i] = 0xFFFFFFFF;  // Clear all interrupt enables
        NVIC->ICPR[i] = 0xFFFFFFFF;  // Clear all interrupt pending flags
    }
    
    // 4. Relocate vector table to Application
    SCB->VTOR = APP_ADDRESS;
    
    // 5. Set main stack pointer MSP
    __set_MSP(app_stack);
    
    // 6. Jump to Application's Reset_Handler
    void (*app_reset_handler)(void) = (void(*)(void))app_entry;
    app_reset_handler();
    
    // Should not reach here
    while(1);
}
```

#### 3.8.3 Application-Side Adaptation

Application's SystemInit must reconfigure VTOR:

```c
// system_stm32g4xx.c - Application version
#define VECT_TAB_OFFSET  0x8000  // Offset 32KB (Bootloader size)

void SystemInit(void) {
    // FPU configuration...
    
    // Critical: relocate vector table to Application start address
    SCB->VTOR = FLASH_BASE + VECT_TAB_OFFSET;  // 0x08000000 + 0x8000
    
    // Other initialization...
}
```

### 3.9 Debug Tips

#### 3.9.1 Inspect Register State During Boot

```c
// Add at the first line of main():
void main(void) {
    volatile uint32_t vtor = SCB->VTOR;        // Check vector table location
    volatile uint32_t msp = __get_MSP();       // Check stack pointer
    volatile uint32_t psp = __get_PSP();       // Check process stack pointer (should be 0)
    volatile uint32_t control = __get_CONTROL();  // Check control register
    
    // Set breakpoint here and inspect the values above
    __NOP();
}
```

#### 3.9.2 Verify Boot Configuration with STM32CubeProgrammer

1. After connecting the chip, select the "Option Bytes" tab
2. Check "User Configuration" → "nBOOT0" and "nSWBOOT0"
3. Check "Read Out Protection" → "RDP" level
4. Check "BOR Level" to confirm brown-out reset threshold

#### 3.9.3 Common Boot Failure Troubleshooting

| Symptom | Possible cause | Troubleshooting |
|------|----------|----------|
| No response on power-on | 1. VDD below VBOR threshold<br>2. Crystal not oscillating | 1. Measure VDD voltage<br>2. Oscilloscope on OSC_IN/OUT waveform |
| Program does not run | 1. Vector table corrupted<br>2. Stack pointer wrong | 1. Read 4 bytes at 0x08000000, should be 0x2000xxxx<br>2. Read 0x08000004, should be in Flash code region |
| Debugger cannot connect | 1. RDP protection enabled<br>2. SWD pins occupied | 1. Check RDP level in CubeProgrammer<br>2. Boot from System Memory then erase Flash |
| Bootloader jump fails | 1. Peripherals/interrupts not shut down<br>2. VTOR not relocated | 1. Fully reset peripherals before jump<br>2. App's SystemInit must set VTOR |

---

## 4 Summary

The STM32 boot flow is a precisely designed multi-layer system:

### 4.1 Core Flow Review

```
Hardware reset → BootROM → boot source selection → Vector Table → Reset_Handler 
   → SystemInit() → C Runtime initialization → main()
```

Each step has a clear division of responsibility:
- **Hardware layer (POR/BOR)**: ensures stable power, provides reliable reset signal
- **BootROM**: reads configuration, selects boot source, performs initial jump
- **Startup file (startup.s)**: defines interrupt vector table, calls system initialization
- **SystemInit()**: configures FPU, VTOR, and other chip-level basics
- **C Runtime**: prepares the C language runtime (.data/.bss initialization)
- **main()**: user code entry, begins application logic

### 4.2 Key Technical Points

1. **Boot source configuration**: modern STM32 (e.g. G4) uses Option Bytes rather than pins alone, providing more flexible configuration
2. **Memory mapping**: 0x00000000 is an alias address, actually mapped to Flash/System Memory/SRAM
3. **Vector table**: the first two entries must be MSP and Reset_Handler—an ARM Cortex-M architecture requirement
4. **Dual initialization**: SystemInit handles chip level, HAL_Init in main handles peripheral level
5. **Bootloader scenario**: must correctly handle peripheral reset, interrupt disable, and VTOR relocation

### 4.3 Practical Application Recommendations

- **Product development**: typically nBOOT0=1 fixed boot from Flash; set RDP Level 1 before shipping to protect code
- **OTA upgrade**: use Bootloader+App dual-region scheme; Bootloader handles firmware verification and jump
- **Debug phase**: keep RDP=0xAA (no protection); boot from System Memory for ISP download when needed
- **Reliability design**: configure appropriate BOR level, enable IWDG, implement stack overflow detection in App

### 4.4 Advanced Learning Directions

- **Secure Boot**: leverage STM32H7/L5 TrustZone and signature verification
- **Multi-bank boot**: STM32H7/F7 dual-bank feature for A/B alternating updates
- **Low-power boot**: special boot flow when waking from Standby/Shutdown mode
- **Debug interface protection**: disable SWD in production builds to prevent firmware readout

---

**References:**
- STM32G4 Series Reference Manual (RM0440)
- STM32G4 Series Datasheet
- Cortex-M4 Technical Reference Manual (ARM DDI 0439)
- AN2606: STM32 microcontroller system memory boot mode
- AN4894: EEPROM emulation on STM32 microcontrollers



Thanks for reading — see you in the next post.



**Last updated: July 13, 2026 20:00:35**
