---
title: STM32的启动流程
description: 详细讲解了STM32在上电后的时间做了什么事情。
date: 2026-07-10
category: 技术
tags: [bootloader, 嵌入式, 软件, STM32, OTA, 学习]
cover: https://assets.virongx.com/blog/covers/STM32_bootloader.png
---

> 启动流程本质：硬件复位→启动模式选择→启动文件执行→系统初始化→应用程序执行的过程。

# STM32启动全流程

> STM32 上电后:
>
> 1. POR/BOR确认电源稳定，释放复位。
> 2. BootROM根据BOOT0和Option Bytes等启动配置确定启动源。 
> 3.  BootROM将对应的存储器映射到启动地址（0x00000000）。 
> 4.  CPU从启动地址读取初始MSP和Reset_Handler地址。 
> 5.  跳转到Reset_Handler开始执行用户程序（或System Bootloader）。

## 目录

- [1 硬件层上电复位](#1-硬件层上电复位)
- [2 执行启动文件](#2-执行启动文件)
- [3 详细介绍：以STM32G4系列为例](#3-详细介绍以stm32g4系列为例)
- [4 总结](#4-总结)

## 1 硬件层上电复位

> 由硬件电路和芯片内部逻辑控制。

### 1.1 上电&复位触发

上电：随着VDD的上升，POR/BOR复位电路开始工作，判断电压是否达到阈值（是：内部Reset释放；否：MCU一直保持Reset），设备复位释放系统启动。

复位按钮：复位信号（NRST 引脚默认高电平）有效（低电平）时，芯片进入复位状态，所有寄存器恢复默认值，按钮释放系统启动。

### 1.2 读取boot地址

**F1系列**：读取 BOOT0（部分系列还有 BOOT1）再决定启动源。

| BOOT1 | BOOT0 | 启动模式                  | 启动地址   |
| :---- | :---- | :------------------------ | :--------- |
| 0     | 0     | 闪存（Flash）启动（常用） | 0x08000000 |
| 0     | 1     | 系统存储器（ISP 下载）    | 0x1FFFF000 |
| 1     | 1     | SRAM 启动（调试）         | 0x20000000 |

> 实际CPU 最开始访问的是：0x00000000
>
> 而这个地址会被硬件映射（Alias）到不同区域（上表启动地址）

**F4/7系列**：已经没有传统意义上的 BOOT1 引脚，启动方式主要由**BOOT0 引脚和Option Bytes（启动配置）**共同决定。

流程：复位电路→CPU开始执行BootROM→BootROM读取BOOT配置→决定启动Flash/System Memory/SRAM

一直提到Option Bytes,那它在哪如何配置？

> Option Bytes 是 STM32 **Flash 中的一块特殊配置区域**，用来保存芯片启动、安全和读写保护等永久配置。

它属于 Flash Controller（FLASH）的管理范围,CPU一般不会去读取Option Bytes。而是BootROM通过FLASH控制器去读取。

可以通过STM32CubeProgrammer/CubeMX（部分可以，且生成代码并不会直接修改芯片的 Option Bytes）；也可根据HAL提供的接口修改。

以H7为例Option Bytes能配置的有，BOOT配置/BOR等级/RDP等级/WRP写保护/PCROP读保护/IWDG配置/双Bank启动/Boot Address/安全配置。

### 1.3 确定启动源

**User Flash 启动**：BootROM 会把控制权交给你的程序

对于 STM32来说Flash 首地址通常是：0x08000000，这里存放的不是 C 代码，而是**中断向量表（Vector Table）**。

**System Memory（进入 ST 官方 Bootloader）：**BootROM直接到System Memory，运行的是ST出厂烧进去的Bootloader，它存放在System Memory，并且支持很多下载协议。

进入System Memory后，等待PC发送HEX文件，烧写Flash之后Reset重新从Flash启动。

[Introduction to system memory boot mode on STM32 MCUs - Application note](https://www.st.com/resource/en/application_note/cd00167594-stm32-microcontroller-system-memory-boot-mode-stmicroelectronics.pdf)

> 当Flash 已经被擦空没有程序了，就可以这样使用

**SRAM 启动（调试模式）：**BootROM直接到SRAM（前提程序必须存在SRAM）。

例如：SRAM 0x20000000 → Vector Table → 程序。

使用该模式基本是调试，IDE直接下载到SRAM中立即运行，不用擦Flash。如果Flash坏了，可以下载程序到SRAM来检查Flash，或者测试Cache/SRAM/CPU。

[Getting started with STM32F4xxxx MCU hardware development - Application note](https://www.st.com/resource/en/application_note/dm00115714.pdf)

### 1.4 跳转到Reset_Handler

此刻已经确认了启动源，接下来读取Vector Table（中断向量表）

Flash 最前面其实长这样：

| 地址       | 内容                 |
| ---------- | -------------------- |
| 0x08000000 | 初始 MSP（主栈指针） |
| 0x08000004 | Reset_Handler 地址   |
| 0x08000008 | NMI_Handler          |
| 0x0800000C | HardFault_Handler    |
| .....      | MemManage_Handler    |

此时CPU第一件事情是读取MSP *(0x08000000)

> 因为马上就要执行函数了,函数会用到PUSH/POP/保存寄存器等，这些全部需要Stack(栈)；没有栈CPU根本不能正常执行函数。

之后继续读取Reset_Handler *(0x08000004)，这个地址里的指就是Reset_Handler。

然后就开始真正执行第一条用户代码了！

## 2 执行启动文件

上一块已经进入Reset_Handler了，而Reset_Handler在startup_xxxxx.s当中

```asm
Reset_Handler    PROC
                 EXPORT  Reset_Handler             [WEAK]
        IMPORT  SystemInit
        IMPORT  __main

                 LDR     R0, =SystemInit	# R0 = &SystemInit
                 BLX     R0					# SystemInit();
                 LDR     R0, =__main		#R0 = __main
                 BX      R0					#跳到__main
                 ENDP
```

> 首先定义了一个函数Reset_Handler()，CPU跳转到这里就开始执行下面的函数体了
>
> 声明一个全局符号 Reset_Handler，告诉链接器（中断向量表第二项就是指向它）实际上这里就是Reset_Handler 地址。
>
> 三四行表示两个函数在别的文件system_stmxxxx.c→SystemInit() Keil Runtime→__main。
>
> 之后才是开始真正的执行；

SystemInit()是CMSIS提供的函数，作用是初始化整个芯片，会配置Cache，MPU，时钟，VTOR，开启FPU，初始化外部RAM等，此时外设都是没有初始化的这些实在main()中调用。

> [!CAUTION]
>
> __main并非main();

在Keil（ARM Compiler）__main不是自己写的，它是来自ARM Runtime Library，此函数负责初始化RAM（复制.data：将Flash参数复制到RAM中 → 清零.bss：int b;根据C标准b=0，启动文件负责memset()全部清零，否则RAM里全是垃圾数据） → 初始化全局变量（初始化c库 → 调用构造函数 ）→main()

此处与GCC的startup不一样，GCC没有__main，是因为GCC将这些工作给拆分了。

---

## 3 详细介绍：以STM32G4系列为例

### 3.1 STM32G4的启动配置详解

STM32G4系列采用现代化的启动配置机制，不再使用传统的BOOT0/BOOT1引脚组合，而是通过**nBOOT0位（Option Bytes）**和**nSWBOOT0位（Option Bytes）**共同决定启动模式。

#### 3.1.1 启动模式选择机制

STM32G4的启动源由以下因素决定：

| nSWBOOT0 | nBOOT0 | 物理BOOT0引脚 | 实际启动源             |
| -------- | ------ | ------------- | ---------------------- |
| 1        | x      | x             | 由nBOOT0位决定         |
| 0        | x      | 0             | System Memory（系统存储器） |
| 0        | x      | 1             | 由nBOOT0位决定         |

当nSWBOOT0=1时，物理BOOT0引脚被忽略，完全由nBOOT0位控制：
- nBOOT0=1：从Flash启动（0x08000000）
- nBOOT0=0：从System Memory启动（0x1FFF0000）

#### 3.1.2 Option Bytes关键配置位

STM32G4的Option Bytes位于Flash的特殊区域（0x1FFF7800），关键配置包括：

**FLASH_OPTR寄存器（Option Byte Register）：**

```c
// 启动配置相关位
#define FLASH_OPTR_nBOOT0_Pos       (27U)
#define FLASH_OPTR_nBOOT0_Msk       (0x1UL << FLASH_OPTR_nBOOT0_Pos)
#define FLASH_OPTR_nSWBOOT0_Pos     (26U)
#define FLASH_OPTR_nSWBOOT0_Msk     (0x1UL << FLASH_OPTR_nSWBOOT0_Pos)

// BOR等级配置（欠压复位阈值）
#define FLASH_OPTR_BOR_LEV_Pos      (8U)
#define FLASH_OPTR_BOR_LEV_Msk      (0x7UL << FLASH_OPTR_BOR_LEV_Pos)
// BOR_LEV=0: 1.7V, BOR_LEV=1: 2.0V, BOR_LEV=2: 2.2V, BOR_LEV=3: 2.5V

// 读保护级别
#define FLASH_OPTR_RDP_Pos          (0U)
#define FLASH_OPTR_RDP_Msk          (0xFFUL << FLASH_OPTR_RDP_Pos)
// RDP=0xAA: 无保护, RDP=其他值: Level 1, RDP=0xCC: Level 2（不可逆）
```

### 3.2 上电复位详细流程

#### 3.2.1 电源上电序列（POR）

STM32G4内部集成了POR（Power-On Reset）和BOR（Brown-Out Reset）电路：

```
VDD上升 → POR电路监测
    ↓
VDD < Vmin(POR) → MCU保持复位状态
    ↓
VDD ≥ VPOR(1.8V典型值) → POR释放
    ↓
VDD ≥ VBOR(根据Option Bytes配置) → BOR释放
    ↓
内部RC振荡器（HSI）启动 → 提供初始时钟（16MHz）
    ↓
复位释放，开始执行BootROM
```

**时序参数（STM32G4数据手册）：**
- tRSTTEMPO：从电源稳定到复位释放的延迟，典型值4.5ms
- VPOR：1.62V ~ 2.0V（取决于温度和电压范围）
- VBOR：可配置为1.7V/2.0V/2.2V/2.5V

#### 3.2.2 BootROM执行流程

STM32G4的BootROM位于芯片内部ROM区域（无法修改），复位后CPU首先执行BootROM代码：

```c
// BootROM伪代码流程
void BootROM_Entry(void) {
    // 1. 读取Option Bytes配置
    uint32_t optr = READ_REG(FLASH->OPTR);
    bool nSWBOOT0 = (optr & FLASH_OPTR_nSWBOOT0_Msk) >> FLASH_OPTR_nSWBOOT0_Pos;
    bool nBOOT0 = (optr & FLASH_OPTR_nBOOT0_Msk) >> FLASH_OPTR_nBOOT0_Pos;
    bool boot0_pin = READ_PIN(BOOT0);
    
    uint32_t boot_address;
    
    // 2. 确定启动源
    if (nSWBOOT0) {
        // 由Option Bytes决定
        boot_address = nBOOT0 ? 0x08000000 : 0x1FFF0000;
    } else {
        // 由物理引脚决定
        boot_address = boot0_pin ? 0x08000000 : 0x1FFF0000;
    }
    
    // 3. 配置内存映射（将启动源映射到0x00000000）
    SYSCFG->MEMRMP = (boot_address == 0x08000000) ? 0x00 : 0x01;
    
    // 4. 从启动地址读取栈指针和复位向量
    uint32_t msp = *(volatile uint32_t*)(boot_address);
    uint32_t reset_handler = *(volatile uint32_t*)(boot_address + 4);
    
    // 5. 设置栈指针并跳转
    __set_MSP(msp);
    void (*reset_func)(void) = (void(*)(void))reset_handler;
    reset_func();  // 跳转到Reset_Handler
}
```

### 3.3 启动文件详解：startup_stm32g4xxxx.s

#### 3.3.1 中断向量表结构

STM32G4的启动文件定义了完整的中断向量表：

```asm
; startup_stm32g431xx.s 节选
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
                
                ; External Interrupts (STM32G4特有外设)
                DCD     WWDG_IRQHandler           ; Window WatchDog
                DCD     PVD_PVM_IRQHandler        ; PVD/PVM through EXTI
                ; ... 共90+个外部中断向量
```

**关键点：**
- `__initial_sp`：由链接器脚本计算，通常指向SRAM末尾（例如：0x20000000 + 128KB）
- 每个DCD（Define Constant Data）占用4字节
- 向量表必须对齐到向量表大小的倍数（STM32G4要求至少128字节对齐）

#### 3.3.2 Reset_Handler详细执行流程

```asm
Reset_Handler   PROC
                EXPORT  Reset_Handler             [WEAK]
                IMPORT  SystemInit
                IMPORT  __main

; ========== 第一步：调用SystemInit() ==========
                LDR     R0, =SystemInit
                BLX     R0
                
; ========== 第二步：跳转到C Runtime初始化 ==========
                LDR     R0, =__main
                BX      R0
                ENDP
```

**指令解析：**
- `LDR R0, =SystemInit`：将SystemInit函数地址加载到R0寄存器
- `BLX R0`：带链接的跳转（Branch with Link and Exchange），调用SystemInit并返回
- `BX R0`：跳转到__main（不返回）

### 3.4 SystemInit()详细实现

#### 3.4.1 system_stm32g4xx.c中的SystemInit()

```c
// system_stm32g4xx.c
void SystemInit(void)
{
    /* FPU设置 -----------------------------------------------------------*/
#if (__FPU_PRESENT == 1) && (__FPU_USED == 1)
    SCB->CPACR |= ((3UL << 10*2)|(3UL << 11*2));  
    // 使能CP10和CP11协处理器（FPU）
    // CP10: 位[21:20] = 0b11, CP11: 位[23:22] = 0b11
#endif

    /* 配置向量表偏移寄存器 VTOR ----------------------------------------*/
#ifdef VECT_TAB_SRAM
    SCB->VTOR = SRAM_BASE | VECT_TAB_OFFSET; 
    // 从SRAM启动时设置（调试模式）
#else
    SCB->VTOR = FLASH_BASE | VECT_TAB_OFFSET; 
    // 通常：FLASH_BASE=0x08000000, OFFSET=0x00
#endif

    /* 时钟配置 ---------------------------------------------------------*/
    // 复位后默认使用HSI（16MHz内部RC振荡器）
    // 用户可以在main()中调用HAL_RCC_OscConfig()切换到HSE/PLL
    
    /* 不在此处初始化外设！SystemInit()只负责最基础的芯片级配置 */
}
```

**关键配置项详解：**

1. **FPU使能（Floating Point Unit）：**
```c
// CPACR: Coprocessor Access Control Register
// 位[23:20]: CP10和CP11访问权限
// 0b00: 禁止访问（默认）
// 0b11: 完全访问（特权和非特权模式）
SCB->CPACR |= ((3UL << 20)|(3UL << 22));
```

2. **VTOR配置（Vector Table Offset Register）：**
```c
// STM32G4允许向量表重定位（用于Bootloader场景）
// 例如：Bootloader在0x08000000，App在0x08008000
// App的SystemInit需要设置：
SCB->VTOR = 0x08008000;  // 向量表偏移到App起始地址
```

### 3.5 C运行时初始化：__main到main()

#### 3.5.1 Keil MDK-ARM的__main流程

```c
// ARM C Library内部实现（伪代码）
void __main(void) {
    // 1. 复制.data段（初始化数据从Flash到RAM）
    extern uint32_t Image$$RW_IRAM1$$Base;      // RAM中.data起始地址
    extern uint32_t Load$$RW_IRAM1$$Base;       // Flash中.data加载地址
    extern uint32_t Image$$RW_IRAM1$$Length;    // .data段长度
    
    memcpy(&Image$$RW_IRAM1$$Base, 
           &Load$$RW_IRAM1$$Base, 
           (size_t)&Image$$RW_IRAM1$$Length);
    
    // 2. 清零.bss段（未初始化数据）
    extern uint32_t Image$$RW_IRAM1$$ZI$$Base;
    extern uint32_t Image$$RW_IRAM1$$ZI$$Length;
    
    memset(&Image$$RW_IRAM1$$ZI$$Base, 0, 
           (size_t)&Image$$RW_IRAM1$$ZI$$Length);
    
    // 3. 初始化C标准库（如果使用了printf等需要初始化的功能）
    __rt_lib_init();  // 初始化堆、semihosting等
    
    // 4. 调用C++全局对象构造函数（如果使用C++）
    __cpp_initialize__aeabi_();
    
    // 5. 跳转到main()
    int result = main();
    
    // 6. main()返回后的清理（通常不会返回）
    exit(result);
}
```

#### 3.5.2 GCC工具链的实现（对比）

GCC的startup文件直接在汇编中完成这些工作：

```asm
Reset_Handler:
    ldr   r0, =_estack      /* 设置栈指针 */
    mov   sp, r0

    /* 复制.data段 */
    ldr r0, =_sdata         /* RAM中.data起始地址 */
    ldr r1, =_edata         /* RAM中.data结束地址 */
    ldr r2, =_sidata        /* Flash中.data加载地址 */
    b LoopCopyDataInit

CopyDataInit:
    ldr r3, [r2], #4        /* 从Flash读取4字节 */
    str r3, [r0], #4        /* 写入RAM */

LoopCopyDataInit:
    cmp r0, r1              /* 检查是否复制完成 */
    bcc CopyDataInit

    /* 清零.bss段 */
    ldr r0, =_sbss
    ldr r1, =_ebss
    mov r2, #0
    b LoopFillZerobss

FillZerobss:
    str r2, [r0], #4

LoopFillZerobss:
    cmp r0, r1
    bcc FillZerobss

    /* 调用SystemInit */
    bl SystemInit
    
    /* 调用main */
    bl main
    
    /* 如果main返回，进入死循环 */
    b .
```

### 3.6 完整启动时序图

```
上电
 │
 ├─> [硬件] VDD上升到VPOR → POR释放
 │
 ├─> [硬件] VDD上升到VBOR → BOR释放 → tRSTTEMPO延迟(~4.5ms)
 │
 ├─> [BootROM] HSI启动(16MHz) → CPU开始执行BootROM
 │              │
 │              ├─> 读取FLASH->OPTR (nSWBOOT0, nBOOT0, BOOT0引脚)
 │              ├─> 决定启动源：0x08000000(Flash) / 0x1FFF0000(System Memory)
 │              ├─> 配置SYSCFG->MEMRMP（内存映射）
 │              ├─> 读取MSP：*(0x08000000) → 设置栈指针
 │              └─> 读取Reset_Handler：*(0x08000004) → 跳转
 │
 ├─> [startup.s] Reset_Handler执行
 │              │
 │              ├─> BLX SystemInit
 │              │      │
 │              │      ├─> 使能FPU (SCB->CPACR)
 │              │      ├─> 配置VTOR (SCB->VTOR = 0x08000000)
 │              │      └─> 返回
 │              │
 │              └─> BX __main
 │
 ├─> [C Runtime] __main执行
 │              │
 │              ├─> 复制.data段 (Flash → RAM)
 │              ├─> 清零.bss段 (memset 0)
 │              ├─> 初始化C库 (__rt_lib_init)
 │              ├─> C++构造函数 (如果有)
 │              └─> 调用main()
 │
 └─> [用户代码] main()开始执行
               │
               ├─> HAL_Init() / LL_Init()
               ├─> SystemClock_Config()  // 配置PLL到170MHz
               ├─> 外设初始化
               └─> while(1) { ... }      // 主循环
```

### 3.7 关键内存布局（STM32G431示例）

#### 3.7.1 Flash布局

```
0x0800 0000  ┌────────────────────────┐
             │  中断向量表 (512 bytes)│  __Vectors
0x0800 0200  ├────────────────────────┤
             │                        │
             │  .text (代码段)        │  Reset_Handler, main(), 所有函数
             │                        │
             ├────────────────────────┤
             │  .rodata (只读数据)    │  const变量, 字符串常量
             ├────────────────────────┤
             │  .data初始值           │  已初始化全局变量的初始值
0x0807 FFFF  └────────────────────────┘  (512KB Flash末尾)
```

#### 3.7.2 RAM布局

```
0x2000 0000  ┌────────────────────────┐
             │  .data (已初始化数据)  │  从Flash复制来的全局变量
             ├────────────────────────┤
             │  .bss (未初始化数据)   │  int a; 这类变量（清零后）
             ├────────────────────────┤
             │                        │
             │  Heap (堆)             │  malloc/new动态分配
             │         ↓              │
             │                        │
             │         ↑              │
             │  Stack (栈)            │  函数调用、局部变量
             │                        │
0x2001 FFFF  └────────────────────────┘  (__initial_sp指向这里，128KB RAM末尾)
```

### 3.8 常见Bootloader场景：双区启动

#### 3.8.1 Bootloader + Application内存分配

```
Flash布局（512KB）:
0x0800 0000  ┌────────────────────────┐
             │  Bootloader (32KB)     │  负责OTA更新、跳转到App
             │  - Vector Table        │
             │  - Bootloader Code     │
0x0800 8000  ├────────────────────────┤
             │  Application (240KB)   │  实际应用程序
             │  - App Vector Table    │
             │  - App Code            │
0x0804 4000  ├────────────────────────┤
             │  Download Area (240KB) │  存放OTA下载的新固件
0x0808 0000  └────────────────────────┘
```

#### 3.8.2 Bootloader跳转到App代码示例

```c
// bootloader.c - 跳转到应用程序
#define APP_ADDRESS     0x08008000  // Application起始地址

void JumpToApplication(void) {
    uint32_t app_stack = *(volatile uint32_t*)APP_ADDRESS;
    uint32_t app_entry = *(volatile uint32_t*)(APP_ADDRESS + 4);
    
    // 1. 检查栈指针合法性（必须在RAM范围内）
    if ((app_stack & 0x2FFE0000) != 0x20000000) {
        return;  // 非法栈地址，放弃跳转
    }
    
    // 2. 关闭所有外设和中断
    HAL_RCC_DeInit();           // 复位RCC到默认状态
    HAL_DeInit();               // 关闭HAL库使用的外设
    
    SysTick->CTRL = 0;          // 关闭SysTick
    SysTick->LOAD = 0;
    SysTick->VAL = 0;
    
    // 3. 禁用所有中断
    for (uint8_t i = 0; i < 8; i++) {
        NVIC->ICER[i] = 0xFFFFFFFF;  // 清除所有中断使能
        NVIC->ICPR[i] = 0xFFFFFFFF;  // 清除所有中断挂起
    }
    
    // 4. 重定向向量表到Application
    SCB->VTOR = APP_ADDRESS;
    
    // 5. 设置主栈指针MSP
    __set_MSP(app_stack);
    
    // 6. 跳转到Application的Reset_Handler
    void (*app_reset_handler)(void) = (void(*)(void))app_entry;
    app_reset_handler();
    
    // 不应该执行到这里
    while(1);
}
```

#### 3.8.3 Application侧的适配

Application的SystemInit需要重新配置VTOR：

```c
// system_stm32g4xx.c - Application版本
#define VECT_TAB_OFFSET  0x8000  // 偏移32KB（Bootloader大小）

void SystemInit(void) {
    // FPU配置...
    
    // 关键：重定向向量表到Application起始地址
    SCB->VTOR = FLASH_BASE + VECT_TAB_OFFSET;  // 0x08000000 + 0x8000
    
    // 其他初始化...
}
```

### 3.9 调试技巧

#### 3.9.1 查看启动过程寄存器状态

```c
// 在main()第一行添加：
void main(void) {
    volatile uint32_t vtor = SCB->VTOR;        // 查看向量表位置
    volatile uint32_t msp = __get_MSP();       // 查看栈指针
    volatile uint32_t psp = __get_PSP();       // 查看进程栈指针（应为0）
    volatile uint32_t control = __get_CONTROL();  // 查看控制寄存器
    
    // 在此处设置断点，查看上述变量值
    __NOP();
}
```

#### 3.9.2 使用STM32CubeProgrammer验证启动配置

1. 连接芯片后，选择"Option Bytes"标签
2. 查看"User Configuration" → "nBOOT0"和"nSWBOOT0"
3. 查看"Read Out Protection" → "RDP"级别
4. 查看"BOR Level"确认欠压复位阈值

#### 3.9.3 常见启动失败排查

| 现象 | 可能原因 | 排查方法 |
|------|----------|----------|
| 上电无反应 | 1. VDD未达到VBOR阈值<br>2. 晶振未起振 | 1. 测量VDD电压<br>2. 示波器查看OSC_IN/OUT波形 |
| 程序不运行 | 1. 向量表损坏<br>2. 栈指针错误 | 1. 读取0x08000000处4字节，应为0x2000xxxx<br>2. 读取0x08000004，应在Flash代码区 |
| 调试器无法连接 | 1. RDP保护开启<br>2. SWD引脚被占用 | 1. CubeProgrammer中检查RDP级别<br>2. 从System Memory启动后擦除Flash |
| Bootloader跳转失败 | 1. 未关闭外设和中断<br>2. VTOR未重定向 | 1. 在跳转前完全复位外设<br>2. App的SystemInit必须设置VTOR |

---

## 4 总结

STM32的启动流程是一个精密设计的多层次系统：

### 4.1 核心流程回顾

```
硬件复位 → BootROM → 启动源选择 → Vector Table → Reset_Handler 
   → SystemInit() → C Runtime初始化 → main()
```

每一步都有明确的职责分工：
- **硬件层（POR/BOR）**：确保电源稳定，提供可靠的复位信号
- **BootROM**：读取配置，选择启动源，完成最初的跳转
- **启动文件（startup.s）**：定义中断向量表，调用系统初始化
- **SystemInit()**：配置FPU、VTOR等芯片级基础功能
- **C Runtime**：准备C语言运行环境（.data/.bss初始化）
- **main()**：用户代码入口，开始应用逻辑

### 4.2 关键技术要点

1. **启动源配置**：现代STM32（如G4）使用Option Bytes而非单纯引脚控制，提供更灵活的配置方式
2. **内存映射**：0x00000000是一个别名地址，实际映射到Flash/System Memory/SRAM
3. **向量表**：前两项必须是MSP和Reset_Handler，这是ARM Cortex-M架构的硬性要求
4. **双重初始化**：SystemInit负责芯片级，main中的HAL_Init负责外设级
5. **Bootloader场景**：必须正确处理外设复位、中断禁用和VTOR重定向

### 4.3 实际应用建议

- **产品开发**：通常nBOOT0=1固定从Flash启动，出厂前设置RDP Level 1保护代码
- **OTA升级**：采用Bootloader+App双区方案，Bootloader负责固件验证和跳转
- **调试阶段**：保持RDP=0xAA（无保护），必要时从System Memory启动进行ISP下载
- **可靠性设计**：配置合适的BOR等级，启用IWDG，在App中实现栈溢出检测

### 4.4 进阶学习方向

- **安全启动（Secure Boot）**：利用STM32H7/L5的TrustZone和签名验证机制
- **多Bank启动**：STM32H7/F7的Dual Bank特性，实现A/B区交替更新
- **低功耗启动**：从Standby/Shutdown模式唤醒的特殊启动流程
- **调试接口保护**：在量产版本中禁用SWD，防止固件被读取

---

**参考资料：**
- STM32G4系列参考手册（RM0440）
- STM32G4系列数据手册
- Cortex-M4技术参考手册（ARM DDI 0439）
- AN2606: STM32微控制器系统存储器启动模式
- AN4894: STM32微控制器中的EEPROM仿真



感谢阅读，我们下篇见。



**本页面更新于: 2026年7月13日 20:00:35**
