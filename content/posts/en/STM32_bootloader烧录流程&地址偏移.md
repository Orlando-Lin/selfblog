---
title: STM32 Bootloader Flash Flow and Address Offset
description: How Boot and App relate—linker/VTOR config and how to flash at the correct addresses.
date: 2026-07-17
category: Tech
tags: [STM32, bootloader, Software, Learning, Embedded]
cover: https://assets.virongx.com/blog/covers/STM32_bootloader烧录流程&地址偏移.png
---

# APP Project Address Offset

With a bootloader, the first slice of Flash is reserved for Boot. The APP must be linked and programmed **after** that region. If the bootloader uses 32 KB (`0x8000` bytes), the APP starts at **`0x08008000`**.

## Keil Address Offset

### 1 Scatter file (`.sct`)

Keil MDK uses the scatter file for load/run addresses. Change `LR_IROM1` / `ER_IROM1` from `0x08000000` to `0x08008000` and reduce the Flash size by the offset.

```
; Before
LR_IROM1 0x0800000 0x00080000  {
  ER_IROM1 0x0800000 0x00080000  {

; After (STM32G474, 512 KB Flash = 0x80000)
LR_IROM1 0x08008000 0x00078000  {
  ER_IROM1 0x08008000 0x00078000  {
```

> Remaining Flash = total − offset: `0x80000 - 0x8000 = 0x78000`

### 2 Vector table offset (`system_stm32g4xx.c`)

After reset the CPU reads the vector table at `0x08000000`. When the APP lives at `0x08008000`, tell the CPU where the table moved.

In `Core/Src/system_stm32g4xx.c`:

```c
#define VECT_TAB_OFFSET  0x00008000U   // 32 KB offset
```

This ends up in `SCB->VTOR`:

```c
SCB->VTOR = VECT_TAB_BASE_ADDRESS | VECT_TAB_OFFSET;
```

| Item | File | Change |
|---|---|---|
| Link/load address | `MDK-ARM/*.sct` | Start `0x08008000`, size minus offset |
| Vector table | `Core/Src/system_stm32g4xx.c` | `VECT_TAB_OFFSET = 0x8000` |

Rebuild; the `.hex` / `.bin` can be programmed at `0x08008000`.

---

## GCC / STM32CubeIDE Address Offset

GCC uses a **`.ld` linker script**, not `.sct`.

### 1 Linker script (`.ld`)

Usually at project root, e.g. `STM32G474RETX_FLASH.ld`. Edit the `MEMORY` block:

```ld
/* Before */
MEMORY
{
  RAM    (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
  FLASH  (rx)  : ORIGIN = 0x08000000,  LENGTH = 512K
}

/* After (bootloader 32 KB, APP from 0x08008000) */
MEMORY
{
  RAM    (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
  FLASH  (rx)  : ORIGIN = 0x08008000,  LENGTH = 480K
}
```

> `480K = 512K - 32K`

### 2 Vector table offset (`system_stm32g4xx.c`)

Same as Keil—toolchain independent:

```c
#define VECT_TAB_OFFSET  0x00008000U
```

### Summary

| Item | File | Change |
|---|---|---|
| Link/load address | `*.ld` (`MEMORY`) | `ORIGIN = 0x08008000`, `LENGTH = 480K` |
| Vector table | `Core/Src/system_stm32g4xx.c` | `VECT_TAB_OFFSET = 0x8000` |

## Keil vs GCC

| Toolchain | Config file | Example |
|---|---|---|
| Keil MDK | `MDK-ARM/*.sct` | `LR_IROM1 0x08008000 0x00078000` |
| GCC / CubeIDE | `*.ld` | `ORIGIN = 0x08008000, LENGTH = 480K` |

`system_stm32g4xx.c` VTOR offset is shared—configure once per APP project.

---

# Bootloader Project Configuration

## Address Layout

STM32 Flash starts at **`0x08000000`**. The CPU boots from there. Bootloader occupies the front; APP follows.

Example: STM32G474 (512 KB Flash), bootloader 32 KB:

```
0x08000000 ──┬── Bootloader (32 KB = 0x8000)
             │
0x08008000 ──┴── APP start
```

**Math:**

```
0x08000000 + 0x8000 = 0x08008000

32 KB = 32 × 1024 = 32768 = 0x8000
```

Hex cheat sheet:

```
 1 KB = 0x0400
 4 KB = 0x1000
32 KB = 0x8000
64 KB = 0x10000
```

---

## Bootloader Linker Script

Limit bootloader Flash to **32 KB** so it cannot spill into the APP region.

```ld
/* Bootloader .ld — FLASH capped at 32 KB */
MEMORY
{
  RAM   (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 32K
}
```

> If LENGTH is 512K, link succeeds even when code exceeds 32 KB—then bootloader silently overwrites APP at `0x08008000`, which is painful to debug.

---

## Bootloader Vector Table (`system_stm32g4xx.c`)

Bootloader runs at `0x08000000` (default map). **No manual VTOR** needed.

Keep defaults commented:

```c
/* #define USER_VECT_TAB_ADDRESS */   // leave commented
```

`SystemInit()` skips VTOR setup; reset default `0x00000000` maps to Flash `0x08000000`—correct for bootloader.

> APP must enable `USER_VECT_TAB_ADDRESS` and set offset; bootloader does the opposite.

---

## `jump_to_app()` Handoff

Typical sequence:

```
1. Read MSP from APP_FLASH_BASE (0x08008000)
2. Read Reset_Handler from APP_FLASH_BASE + 4
3. Disable IRQs, clear SysTick
4. Set SCB->VTOR to APP vector table
5. Set MSP and branch to APP Reset_Handler
```

```c
static void jump_to_app(uint32_t app_base)
{
    uint32_t msp   = *(volatile uint32_t *)app_base;
    uint32_t reset = *(volatile uint32_t *)(app_base + 4U);
    void (*app_reset)(void) = (void (*)(void))reset;

    __disable_irq();
    SysTick->CTRL = 0U;
    SysTick->LOAD = 0U;
    SysTick->VAL  = 0U;
    SCB->VTOR = app_base;
    __DSB();
    __ISB();
    __set_MSP(msp);
    app_reset();
}
```

---

## Troubleshooting

### Issue 1: APP does not run after jump

**Likely cause: no valid APP in Flash.**

Erased Flash reads `0xFFFFFFFF` at `0x08008000`—calling that as a function HardFaults immediately.

**Fix: validate APP before jump.**

```c
uint32_t msp   = *(volatile uint32_t *)APP_FLASH_BASE;
uint32_t reset = *(volatile uint32_t *)(APP_FLASH_BASE + 4U);

if (msp < 0x20000000UL || msp > 0x20020000UL) return;
if ((reset & 0x1U) == 0U || reset < APP_FLASH_BASE)   return;
```

### Issue 2: IRQs behave wrongly in APP

**Cause: APP `system_stm32g4xx.c` missing VTOR offset (or offset = 0).**

APP `SystemInit()` runs on startup; `VECT_TAB_OFFSET = 0` resets VTOR to `0x08000000` (bootloader vectors)—IRQs hit bootloader ISRs.

**Fix in APP project:**

```c
#define USER_VECT_TAB_ADDRESS
#define VECT_TAB_BASE_ADDRESS   FLASH_BASE
#define VECT_TAB_OFFSET         0x00008000U
```

### Issue 3: Intermittent fault right after VTOR write

**Cause: missing barriers on Cortex-M4.**

Add `__DSB(); __ISB();` after `SCB->VTOR = app_base` (see example above).

---

## Configuration Checklist

| Check | Bootloader | APP |
|---|---|---|
| Linker ORIGIN | `0x08000000` | `0x08008000` |
| Linker LENGTH | `32K` (cap) | `480K` (512K−32K) |
| `USER_VECT_TAB_ADDRESS` | Commented out | Enabled |
| `VECT_TAB_OFFSET` | N/A | `0x00008000U` |
| APP validity before jump | Required | — |
| DSB/ISB after VTOR | Required | — |



**Last updated: July 13, 2026 20:00:35**
