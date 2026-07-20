---
title: STM32 bootloader 烧录流程&地址偏移
description: 收纳了boot和app直接关系如何去配置&烧录，地址应该怎么写
date: 2026-07-17
category: 技术
tags: [STM32, bootloader, 软件, 学习, 嵌入式]
cover: https://assets.virongx.com/blog/covers/STM32_bootloader烧录流程&地址偏移.png
---

# APP 工程地址偏移配置

当项目使用 bootloader 时，bootloader 占用 Flash 起始的一段空间，APP 工程必须烧录到 bootloader 之后的地址。以 bootloader 占用 32KB（0x8000 字节）为例，APP 起始地址为 `0x08008000`。

## Keil地址偏移配置

### 1 Scatter 文件（.sct）

Keil MDK 通过 scatter 文件决定代码链接和加载地址。将 `LR_IROM1` 和 `ER_IROM1` 的起始地址从 `0x08000000` 改为 `0x08008000`，Flash 大小相应减去偏移量。

```
; 修改前
LR_IROM1 0x08000000 0x00080000  {
  ER_IROM1 0x08000000 0x00080000  {

; 修改后（STM32G474，总 Flash 512KB = 0x80000）
LR_IROM1 0x08008000 0x00078000  {
  ER_IROM1 0x08008000 0x00078000  {
```

> Flash 剩余大小 = 总大小 − 偏移量，即 `0x80000 - 0x8000 = 0x78000`

### 2 向量表偏移（system_stm32g4xx.c）

CPU 复位后默认从 `0x08000000` 读取向量表，APP 被搬移到 `0x08008000` 后，需要告知 CPU 向量表的新位置。

在 `Core/Src/system_stm32g4xx.c` 中配置：

```c
#define VECT_TAB_OFFSET  0x00008000U   // 偏移 32KB
```

该宏最终写入 `SCB->VTOR`，CPU 据此找到正确的中断向量表：

```c
SCB->VTOR = VECT_TAB_BASE_ADDRESS | VECT_TAB_OFFSET;
```


| 配置项     | 文件                            | 修改内容                          |
| ------- | ----------------------------- | ----------------------------- |
| 链接/加载地址 | `MDK-ARM/*.sct`               | 起始地址改为 `0x08008000`，大小减去偏移     |
| 向量表位置   | `Core/Src/system_stm32g4xx.c` | `VECT_TAB_OFFSET` 设为 `0x8000` |


两处均配置完成后重新编译，生成的 `.hex` / `.bin` 即可烧录到 `0x08008000`。

---

## GCC 工程（STM32CubeIDE）地址偏移配置

GCC 工具链不使用 `.sct` 文件，改用链接脚本 `.ld` 文件控制地址。

### 1 链接脚本（.ld）

文件通常位于工程根目录，名如 `STM32G474RETX_FLASH.ld`。找到 `MEMORY` 块，修改 FLASH 的起始地址和大小：

```ld
/* 修改前 */
MEMORY
{
  RAM    (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
  FLASH  (rx)  : ORIGIN = 0x08000000,  LENGTH = 512K
}

/* 修改后（bootloader 占 32KB，APP 从 0x08008000 开始） */
MEMORY
{
  RAM    (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
  FLASH  (rx)  : ORIGIN = 0x08008000,  LENGTH = 480K
}
```

> `480K = 512K - 32K`，即总 Flash 减去 bootloader 占用部分。

### 2 向量表偏移（system_stm32g4xx.c）

与 Keil 版本完全相同，无需区分工具链：

```c
#define VECT_TAB_OFFSET  0x00008000U
```

### 总结


| 配置项     | 文件                            | 修改内容                                 |
| ------- | ----------------------------- | ------------------------------------ |
| 链接/加载地址 | `*.ld`（MEMORY 块）              | `ORIGIN = 0x08008000`，`LENGTH = 480K` |
| 向量表位置   | `Core/Src/system_stm32g4xx.c` | `VECT_TAB_OFFSET` 设为 `0x8000`        |


## Keil vs GCC 对比


| 工具链                | 地址配置文件          | 格式                                  |
| ------------------ | --------------- | ----------------------------------- |
| Keil MDK           | `MDK-ARM/*.sct` | `LR_IROM1 0x08008000 0x00078000`     |
| GCC / STM32CubeIDE | `*.ld`          | `ORIGIN = 0x08008000, LENGTH = 480K` |


向量表偏移（`system_stm32g4xx.c`）两者通用，只需配置一次。

---

# Bootloader 工程配置

## 地址划分原理

STM32 Flash 起始地址固定为 `0x08000000`，CPU 上电后从这里读取向量表并执行。Bootloader 占据最前面的一段空间，APP 紧随其后。

以 STM32G474（512KB Flash）、Bootloader 占 32KB 为例：

```
0x08000000 ──┬── Bootloader（32KB = 0x8000 字节）
             │
0x08008000 ──┴── APP 起始地址
```

**地址计算：**

```
0x08000000 + 0x8000 = 0x08008000

其中 32KB → 32 × 1024 = 32768 字节 = 0x8000
```

十六进制换算规律：

```
1  KB = 0x0400
4  KB = 0x1000
32 KB = 0x8000
64 KB = 0x10000
```

---

## Bootloader 链接脚本配置

Bootloader 自身的链接脚本 **必须限制在 32KB 以内**，防止代码溢出覆盖 APP 区。

```ld
/* Bootloader 的 .ld 文件，FLASH 只给 32KB */
MEMORY
{
  RAM   (xrw) : ORIGIN = 0x20000000, LENGTH = 128K
  FLASH (rx)  : ORIGIN = 0x08000000, LENGTH = 32K   /* 限定 bootloader 最大 32KB */
}
```

> 如果不限制 LENGTH 而填 512K，编译链接不会报错，但一旦 bootloader 代码超过 32KB，就会悄悄覆盖 `0x08008000` 后的 APP 区，且 APP 运行异常时很难发现原因。

---

## Bootloader 向量表配置（system_stm32g4xx.c）

Bootloader 从 `0x08000000` 启动，这是芯片默认映射地址，**无需手动设置 VTOR**。

`Core/Src/system_stm32g4xx.c` 中保持默认注释状态即可：

```c
/* #define USER_VECT_TAB_ADDRESS */   // 保持注释，不需要设置
```

`SystemInit()` 里对应代码被条件编译跳过，VTOR 保持复位默认值 `0x00000000`（硬件自动映射到 Flash `0x08000000`），对 bootloader 是正确的。

> 与 APP 工程对比：APP 需要开启 `USER_VECT_TAB_ADDRESS` 并设置偏移；Bootloader 不需要，两者配置方向相反。

---

## jump_to_app() 跳转机制

Bootloader 完成任务后通过以下步骤跳转到 APP：

```
1. 从 APP_FLASH_BASE（0x08008000）读出 MSP（栈顶指针）
2. 从 APP_FLASH_BASE + 4 读出 Reset_Handler 地址
3. 关闭所有中断，清零 SysTick
4. 设置 SCB->VTOR 指向 APP 向量表
5. 设置 MSP，跳转执行 APP 的 Reset_Handler
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
    __DSB();          // 等待 VTOR 写入完成
    __ISB();          // 刷新流水线
    __set_MSP(msp);
    app_reset();
}
```

---

## 常见问题与排查

### 问题1：跳转后 APP 不执行

**最可能的原因：APP 区没有有效程序。**

Flash 未烧录或已擦除时，`0x08008000` 处的值是 `0xFFFFFFFF`，当作函数指针调用会立即 HardFault。

**修复：跳转前校验 APP 是否存在。**

```c
uint32_t msp   = *(volatile uint32_t *)APP_FLASH_BASE;
uint32_t reset = *(volatile uint32_t *)(APP_FLASH_BASE + 4U);

// MSP 必须指向 RAM 范围，Reset 向量 bit0 必须为1（Thumb 指令集）
if (msp < 0x20000000UL || msp > 0x20020000UL) return; // 无有效 APP
if ((reset & 0x1U) == 0U || reset < APP_FLASH_BASE)   return;
```

### 问题2：APP 运行时中断行为异常

**原因：APP 的 `system_stm32g4xx.c` 未配置 VTOR 偏移，或偏移填了 `0`。**

APP 的 `SystemInit()` 在启动时会再次执行，若 `VECT_TAB_OFFSET = 0`，会把 VTOR 重置回 `0x08000000`（bootloader 的向量表），导致所有中断跳进 bootloader 的 ISR。

**修复：APP 工程中配置正确的偏移。**

```c
// APP 工程的 system_stm32g4xx.c
#define USER_VECT_TAB_ADDRESS
#define VECT_TAB_BASE_ADDRESS   FLASH_BASE      // 0x08000000
#define VECT_TAB_OFFSET         0x00008000U     // 偏移 32KB
```

### 问题3：VTOR 写入后跳转偶发异常

**原因：缺少内存屏障指令。**

Cortex-M4 是乱序执行架构，`SCB->VTOR` 写入后若不加屏障，CPU 可能在 VTOR 生效前就完成了分支预取。

**修复：** 在 `SCB->VTOR = app_base` 之后加 `__DSB(); __ISB();`（见上方代码示例）。

---

## 配置检查清单


| 检查项                     | Bootloader 工程 | APP 工程           |
| ----------------------- | ------------- | ---------------- |
| 链接脚本 ORIGIN             | `0x08000000`  | `0x08008000`     |
| 链接脚本 LENGTH             | `32K`（限定大小）   | `480K`（512K−32K） |
| `USER_VECT_TAB_ADDRESS` | 注释掉（不设置）      | 开启               |
| `VECT_TAB_OFFSET`       | 无需配置          | `0x00008000U`    |
| 跳转前 APP 有效性校验           | 必须加           | —                |
| VTOR 写入后 DSB/ISB        | 必须加           | —                |




**本页面更新于: 2026年7月13日 20:00:35**