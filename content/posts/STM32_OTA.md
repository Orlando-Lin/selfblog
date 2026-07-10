---
title: STM32实现OTA升级
description: 包含了OTA的所有情况
date: 2026-07-10
category: 技术
tags: [STM32, OTA, 软件, 学习, 嵌入式]
cover: https://assets.virongx.com/blog/covers/STM32_OTA.png
---

> 学习顺序:理解32启动流程→写BootLoader跳APP→Flash擦写→CAN OTA协议→双APP升级→云端OTA

# 基于STM32的BootLoader实现OTA升级

OTA（Over-The-Air）远程升级技术；无需通过JTAG等方式进行烧录，通过无线通信实现固件动态更新，方便快捷。

基于STM32的BootLoader实现OTA需解决三大核心问题：1）如何设计可靠的固件存储结构；2）如何确保升级过程的安全性；3）如何实现异常恢复机制。

接下来让我们，按照流程来了解它！

## 1. STM32启动流程

> 目标：理解为什么OTA可以实现。

超链接：详细启动流程见《STM32_bootloader.md》，此处仅简述与OTA相关的部分。

**核心原理**：STM32上电后从Flash起始地址（0x08000000）读取中断向量表，跳转到Reset_Handler执行。

```
上电 → BootROM → 读取0x08000000 → 加载MSP和Reset_Handler → 开始执行程序
```

**OTA利用的关键点**：
1. Flash可以分区：Bootloader区 + App A区 + App B区
2. Bootloader可以控制跳转到不同地址的Application
3. Flash可以擦写，实现固件更新

**启动判断流程**：
```
MCU复位 → Bootloader启动(0x08000000)
    ↓
检查是否有升级请求？
    ↓ 是
接收新固件 → 写入备用区 → 校验 → 标记为活动分区
    ↓ 否
读取活动分区标志
    ↓
App A活动？校验通过？→ 跳转App A
App B活动？校验通过？→ 跳转App B
都失败？→ 进入升级模式等待固件
```

---

## 2. Flash分区设计

> 目标：理解OTA的存储架构，这是整个系统的基础。

### 2.1 三种分区方案对比

#### 方案一：单应用区（不推荐）

```
┌──────────────────────────────┐ 0x08000000
│  Bootloader (32KB)           │
├──────────────────────────────┤ 0x08008000
│  Application (240KB)         │ ← 当前运行
├──────────────────────────────┤ 0x08044000
│  Download Buffer (240KB)     │ ← 临时存储新固件
└──────────────────────────────┘ 0x08080000
```

**升级流程**：下载到Buffer → 擦除App → 复制Buffer到App → 重启

**致命缺陷**：复制过程中断电，App区被破坏且无备份，设备变砖！

#### 方案二：双应用区（推荐）

```
┌──────────────────────────────┐ 0x08000000
│  Bootloader (32KB)           │ ← 永不更新
├──────────────────────────────┤ 0x08008000
│  App A (240KB)               │ ← 旧版本固件
├──────────────────────────────┤ 0x08044000
│  App B (240KB)               │ ← 新版本固件
├──────────────────────────────┤ 0x0807F000
│  Params (4KB)                │ ← 存储标志位和版本信息
└──────────────────────────────┘ 0x08080000
```

**升级流程**：下载到备用区(App B) → 校验 → 切换活动标志 → 重启 → 运行新固件

**优势**：
- ✅ 升级失败可回滚
- ✅ 断电后仍能运行旧固件
- ✅ 支持A/B乒乓升级

#### 方案三：压缩固件+解压（高级方案）

```
┌──────────────────────────────┐
│  Bootloader (32KB)           │
├──────────────────────────────┤
│  Application (240KB)         │
├──────────────────────────────┤
│  Compressed FW (120KB)       │ ← 压缩后的固件包（节省50%空间）
└──────────────────────────────┘
```

**优势**：节省传输时间和Flash空间

**代价**：需要集成解压缩库（如tinflate），增加Bootloader复杂度

### 2.2 参数区设计

参数区用于存储系统状态，需要掉电保持。

#### 选择A：Flash最后一个扇区（推荐）

```c
// 定义参数区地址（STM32G4, 512KB Flash为例）
#define PARAMS_ADDR      0x0807F000  // 最后4KB扇区

typedef struct {
    uint32_t magic;              // 0x5AA5F00F（识别参数区有效性）
    uint8_t  active_partition;   // 0=App A, 1=App B
    uint8_t  boot_count;         // 启动次数（检测重启循环）
    uint8_t  update_flag;        // 0=正常运行, 1=等待升级, 2=升级中
    uint8_t  reserved;
    
    // App A信息
    uint32_t app_a_version;
    uint32_t app_a_size;
    uint32_t app_a_crc32;
    
    // App B信息
    uint32_t app_b_version;
    uint32_t app_b_size;
    uint32_t app_b_crc32;
    
    uint32_t crc;                // 参数区自身CRC校验
} BootParams_t;
```

**读写示例**：
```c
// 读取参数
BootParams_t params;
memcpy(&params, (void*)PARAMS_ADDR, sizeof(BootParams_t));

// 验证参数有效性
if (params.magic != 0x5AA5F00F || CRC32_Check(&params) != params.crc) {
    // 参数损坏，恢复默认值
    InitDefaultParams(&params);
}

// 更新参数（需要先擦除扇区）
HAL_FLASH_Unlock();
FLASH_EraseInitTypeDef erase = {
    .TypeErase = FLASH_TYPEERASE_PAGES,
    .Page = 127,  // 最后一页
    .NbPages = 1
};
uint32_t error;
HAL_FLASHEx_Erase(&erase, &error);

// 写入新参数
uint32_t *src = (uint32_t*)&params;
for (int i = 0; i < sizeof(BootParams_t)/4; i++) {
    HAL_FLASH_Program(FLASH_TYPEPROGRAM_WORD, PARAMS_ADDR + i*4, src[i]);
}
HAL_FLASH_Lock();
```

#### 选择B：RTC备份寄存器（快但容量小）

```c
// STM32G4有32个32位备份寄存器（128字节）
#define BOOT_MAGIC_REG     RTC->BKP0R
#define ACTIVE_PART_REG    RTC->BKP1R
#define APP_A_VER_REG      RTC->BKP2R
#define APP_B_VER_REG      RTC->BKP3R

// 写入前需要使能备份域访问
__HAL_RCC_PWR_CLK_ENABLE();
HAL_PWR_EnableBkUpAccess();

BOOT_MAGIC_REG = 0x5AA5F00F;
ACTIVE_PART_REG = 1;  // 切换到App B

HAL_PWR_DisableBkUpAccess();
```

**优点**：读写快，无需擦除  
**缺点**：容量小，不适合存储大量信息

### 2.3 地址宏定义（代码中统一使用）

```c
// flash_map.h - Flash分区映射
#define FLASH_BASE_ADDR       0x08000000

// Bootloader区
#define BOOTLOADER_ADDR       (FLASH_BASE_ADDR)
#define BOOTLOADER_SIZE       (32 * 1024)  // 32KB

// App A区
#define APP_A_ADDR            (BOOTLOADER_ADDR + BOOTLOADER_SIZE)
#define APP_A_SIZE            (240 * 1024) // 240KB

// App B区
#define APP_B_ADDR            (APP_A_ADDR + APP_A_SIZE)
#define APP_B_SIZE            (240 * 1024)

// 参数区
#define PARAMS_ADDR           (0x0807F000)
#define PARAMS_SIZE           (4 * 1024)

// 地址有效性检查宏
#define IS_FLASH_ADDR(addr)   ((addr) >= FLASH_BASE_ADDR && \
                               (addr) < (FLASH_BASE_ADDR + 512*1024))
```

---

## 3. Bootloader核心功能实现

> 目标：掌握Bootloader的关键代码实现。

### 3.1 Bootloader主流程

```c
// main.c - Bootloader主函数
int main(void) {
    HAL_Init();
    SystemClock_Config();
    
    // 1. 初始化外设（用于接收固件）
    UART_Init();  // 或 CAN_Init() / ETH_Init()
    
    // 2. 读取启动参数
    BootParams_t params;
    ReadBootParams(&params);
    
    // 3. 检查是否强制进入升级模式
    if (IsUpgradeButtonPressed() || params.update_flag == UPDATE_REQUESTED) {
        EnterUpdateMode();  // 等待接收新固件
        return 0;
    }
    
    // 4. 检测启动循环（防止坏固件无限重启）
    params.boot_count++;
    if (params.boot_count > 3) {
        // 超过3次重启，固件可能有问题
        params.active_partition ^= 1;  // 切换到备用分区
        params.boot_count = 0;
    }
    WriteBootParams(&params);
    
    // 5. 确定要跳转的App地址
    uint32_t app_addr;
    if (params.active_partition == 0) {
        app_addr = APP_A_ADDR;
        if (!VerifyApplication(app_addr, params.app_a_size, params.app_a_crc32)) {
            app_addr = APP_B_ADDR;  // App A损坏，尝试App B
        }
    } else {
        app_addr = APP_B_ADDR;
        if (!VerifyApplication(app_addr, params.app_b_size, params.app_b_crc32)) {
            app_addr = APP_A_ADDR;  // App B损坏，尝试App A
        }
    }
    
    // 6. 最终校验
    if (!VerifyApplication(app_addr, 0, 0)) {
        // 两个分区都损坏，进入升级模式
        EnterUpdateMode();
        return 0;
    }
    
    // 7. 跳转到应用程序
    JumpToApplication(app_addr);
    
    // 不应该执行到这里
    while(1);
}
```

### 3.2 固件校验函数

校验是OTA的安全保障，防止运行损坏或恶意固件。

```c
// verify.c - 固件校验
bool VerifyApplication(uint32_t app_addr, uint32_t size, uint32_t expected_crc) {
    // 1. 检查地址合法性
    if (!IS_FLASH_ADDR(app_addr)) {
        return false;
    }
    
    // 2. 检查栈指针合法性（向量表第一项）
    uint32_t msp = *(volatile uint32_t*)app_addr;
    if ((msp & 0x2FFE0000) != 0x20000000) {
        // 栈指针必须在SRAM范围内（0x20000000 ~ 0x2001FFFF）
        return false;
    }
    
    // 3. 检查Reset_Handler地址合法性（向量表第二项）
    uint32_t reset_handler = *(volatile uint32_t*)(app_addr + 4);
    if (!IS_FLASH_ADDR(reset_handler) || (reset_handler & 0x1) == 0) {
        // Reset_Handler必须在Flash中且最低位为1（Thumb指令）
        return false;
    }
    
    // 4. CRC校验（可选，如果提供了size和expected_crc）
    if (size > 0 && expected_crc != 0) {
        uint32_t calc_crc = CRC32_Calculate((uint8_t*)app_addr, size);
        if (calc_crc != expected_crc) {
            return false;
        }
    }
    
    return true;
}

// CRC32计算（硬件CRC外设）
uint32_t CRC32_Calculate(uint8_t *data, uint32_t size) {
    __HAL_RCC_CRC_CLK_ENABLE();
    CRC->CR = CRC_CR_RESET;  // 复位CRC
    
    uint32_t *ptr = (uint32_t*)data;
    uint32_t len = size / 4;
    
    for (uint32_t i = 0; i < len; i++) {
        CRC->DR = ptr[i];
    }
    
    // 处理剩余字节
    uint32_t remain = size % 4;
    if (remain > 0) {
        uint32_t last = 0;
        memcpy(&last, &data[len*4], remain);
        CRC->DR = last;
    }
    
    return CRC->DR;
}
```

**为什么需要多重校验？**
- 栈指针校验：防止跳转到无效地址导致HardFault
- Reset_Handler校验：确保有有效的入口函数
- CRC校验：检测数据完整性（传输错误、Flash写入错误）

### 3.3 跳转到应用程序

这是Bootloader最关键的操作，必须正确清理环境。

```c
// jump.c - 跳转到应用程序
void JumpToApplication(uint32_t app_addr) {
    // 0. 清除更新标志和启动计数（成功启动后）
    // 注意：应该在App运行稳定后清除，这里先设置一个标志
    
    // 1. 关闭所有使用的外设
    HAL_UART_DeInit(&huart1);
    HAL_CAN_DeInit(&hcan1);
    // ... 其他外设
    
    // 2. 关闭所有中断
    __disable_irq();
    
    for (uint8_t i = 0; i < 8; i++) {
        NVIC->ICER[i] = 0xFFFFFFFF;  // 禁用所有中断
        NVIC->ICPR[i] = 0xFFFFFFFF;  // 清除所有中断挂起
    }
    
    // 3. 关闭SysTick
    SysTick->CTRL = 0;
    SysTick->LOAD = 0;
    SysTick->VAL = 0;
    
    // 4. 复位所有外设时钟（可选但推荐）
    HAL_RCC_DeInit();
    
    // 5. 重定向向量表
    SCB->VTOR = app_addr;
    
    // 6. 读取App的栈指针和入口地址
    uint32_t msp = *(volatile uint32_t*)app_addr;
    uint32_t reset_handler = *(volatile uint32_t*)(app_addr + 4);
    
    // 7. 设置栈指针
    __set_MSP(msp);
    
    // 8. 跳转到App的Reset_Handler
    void (*app_entry)(void) = (void(*)(void))reset_handler;
    app_entry();
    
    // 不应该执行到这里
    while(1);
}
```

**关键注意事项**：

| 步骤 | 为什么必须做 |
|------|-------------|
| 关闭外设 | 避免外设中断影响App初始化 |
| 禁用中断 | 防止中断向量表错乱导致HardFault |
| 关闭SysTick | App会重新配置SysTick，不关闭会冲突 |
| 重定向VTOR | 让CPU找到App的中断向量表 |
| 设置MSP | App的栈空间可能与Bootloader不同 |

---

## 4. Flash读写操作详解

> 目标：掌握Flash编程，这是写入固件的核心技术。

### 4.1 STM32 Flash基础知识

#### 不同系列Flash特性对比

| 系列 | 擦除单位 | 写入单位 | 擦除时间 | 典型擦除次数 |
|------|---------|---------|---------|-------------|
| F1   | 1KB/2KB页 | 半字(2字节) | ~20ms/页 | 10,000次 |
| F4   | 16KB~128KB扇区 | 字节 | ~500ms/扇区 | 10,000次 |
| G4   | 2KB页 | 双字(8字节) | ~25ms/页 | 10,000次 |
| H7   | 8KB扇区 | 256位(32字节) | ~5ms/扇区 | 100,000次 |

**关键特性**：
- ✅ Flash必须先擦除（全1）才能写入
- ✅ 写入只能从1变0，不能从0变1
- ✅ 擦除次数有限，频繁擦写会降低寿命

### 4.2 HAL库Flash操作封装

#### 4.2.1 擦除Flash

```c
// flash_ops.c - Flash操作
bool Flash_EraseSector(uint32_t addr, uint32_t size) {
    HAL_FLASH_Unlock();
    
    // 计算要擦除的页数（STM32G4为例，2KB/页）
    uint32_t start_page = (addr - FLASH_BASE_ADDR) / FLASH_PAGE_SIZE;
    uint32_t num_pages = (size + FLASH_PAGE_SIZE - 1) / FLASH_PAGE_SIZE;
    
    FLASH_EraseInitTypeDef erase_init = {
        .TypeErase = FLASH_TYPEERASE_PAGES,
        .Banks = FLASH_BANK_1,  // 根据地址选择Bank
        .Page = start_page,
        .NbPages = num_pages
    };
    
    uint32_t page_error = 0;
    HAL_StatusTypeDef status = HAL_FLASHEx_Erase(&erase_init, &page_error);
    
    HAL_FLASH_Lock();
    
    if (status != HAL_OK || page_error != 0xFFFFFFFF) {
        // 擦除失败，记录错误页
        return false;
    }
    
    return true;
}
```

#### 4.2.2 写入Flash

```c
bool Flash_Write(uint32_t addr, uint8_t *data, uint32_t size) {
    if (addr % 8 != 0) {
        // STM32G4要求8字节对齐
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
    
    // 回读校验（可选但推荐）
    if (memcmp((void*)addr, data, size) != 0) {
        return false;
    }
    
    return true;
}
```

### 4.3 Flash写入优化技巧

#### 技巧1：页缓存（减少擦除次数）

```c
#define PAGE_BUFFER_SIZE  2048  // 2KB页缓存

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
        
        // 检查是否需要刷新缓存
        if (g_cache.dirty && g_cache.base_addr != page_base) {
            FlushCache();
        }
        
        // 首次写入此页，先读取整页内容
        if (!g_cache.dirty || g_cache.base_addr != page_base) {
            memcpy(g_cache.buffer, (void*)page_base, PAGE_BUFFER_SIZE);
            g_cache.base_addr = page_base;
            g_cache.dirty = false;
        }
        
        // 写入缓存
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

**优势**：
- 同一页内多次写入只擦除一次
- 减少Flash擦除次数，延长寿命

#### 技巧2：后台擦除（提升用户体验）

```c
// 在接收固件前预先擦除目标区域
void PrepareFlashArea(uint32_t addr, uint32_t size) {
    // 显示进度：擦除中...
    Flash_EraseSector(addr, size);
    // 擦除完成，等待数据
}

// 接收数据时直接写入，无需等待擦除
void OnDataReceived(uint8_t *data, uint32_t size) {
    Flash_Write(g_current_addr, data, size);
    g_current_addr += size;
}
```

---

## 5. 通信协议实现

> 目标：实现固件传输协议，支持UART/CAN/以太网等多种方式。

### 5.1 协议选型对比

| 协议 | 速度 | 距离 | 复杂度 | 适用场景 |
|------|------|------|--------|---------|
| UART | 115200~921600 bps | <15m | 低 | 调试、本地升级 |
| CAN  | 1Mbps | <40m | 中 | 车载、工控 |
| SPI  | 10Mbps+ | <1m | 低 | 外部Flash存储 |
| 以太网 | 100Mbps | <100m | 高 | 网络设备 |
| USB  | 12Mbps(FS) | <5m | 中 | PC连接升级 |
| Wi-Fi | 1~100Mbps | <50m | 高 | IoT设备 |
### 5.2 通用OTA协议设计

设计一个简单但可靠的协议，适配多种通信方式。

#### 5.2.1 协议帧格式

```
┌────────┬────────┬────────┬────────────┬──────────┬────────┐
│ Header │ CMD    │ Length │ Data       │ CRC16    │ Tail   │
│ 2Byte  │ 1Byte  │ 2Byte  │ 0~1024Byte │ 2Byte    │ 2Byte  │
└────────┴────────┴────────┴────────────┴──────────┴────────┘
  0xAA55   命令码   数据长度   实际数据      校验      0x55AA
```

**字段说明**：
- **Header（0xAA55）**：帧头，用于同步
- **CMD**：命令码（见下表）
- **Length**：Data字段长度（不含其他字段）
- **Data**：命令参数或固件数据
- **CRC16**：校验码（从CMD到Data的所有字节）
- **Tail（0x55AA）**：帧尾

#### 5.2.2 命令定义

```c
// ota_protocol.h
typedef enum {
    CMD_HANDSHAKE       = 0x01,  // 握手，建立连接
    CMD_GET_INFO        = 0x02,  // 获取设备信息
    CMD_START_UPDATE    = 0x10,  // 开始升级（发送固件信息）
    CMD_SEND_DATA       = 0x11,  // 发送固件数据包
    CMD_END_UPDATE      = 0x12,  // 结束升级
    CMD_VERIFY          = 0x13,  // 校验固件
    CMD_REBOOT          = 0x14,  // 重启设备
    
    CMD_ACK             = 0xA0,  // 应答成功
    CMD_NACK            = 0xA1,  // 应答失败（携带错误码）
} OTA_CMD_t;

typedef enum {
    ERR_NONE            = 0x00,
    ERR_CRC             = 0x01,  // 校验错误
    ERR_INVALID_CMD     = 0x02,  // 无效命令
    ERR_FLASH_ERASE     = 0x03,  // Flash擦除失败
    ERR_FLASH_WRITE     = 0x04,  // Flash写入失败
    ERR_SIZE_OVERFLOW   = 0x05,  // 固件大小超限
    ERR_VERSION_LOW     = 0x06,  // 版本号过低
    ERR_VERIFY_FAIL     = 0x07,  // 固件校验失败
} OTA_ERROR_t;
```

#### 5.2.3 升级流程时序图

```
上位机                              设备
  │                                  │
  ├───── CMD_HANDSHAKE ──────────────>│
  │                                  │ 检查是否Bootloader模式
  │<────── CMD_ACK (设备信息) ───────┤
  │                                  │
  ├───── CMD_START_UPDATE ───────────>│ 固件大小、版本、CRC
  │                                  │ 检查版本、擦除Flash
  │<────── CMD_ACK ──────────────────┤
  │                                  │
  ├───── CMD_SEND_DATA (包0) ────────>│ 写入Flash
  │<────── CMD_ACK ──────────────────┤
  ├───── CMD_SEND_DATA (包1) ────────>│
  │<────── CMD_ACK ──────────────────┤
  │          ... (循环发送) ...       │
  ├───── CMD_SEND_DATA (包N) ────────>│
  │<────── CMD_ACK ──────────────────┤
  │                                  │
  ├───── CMD_END_UPDATE ─────────────>│
  │<────── CMD_ACK ──────────────────┤
  │                                  │
  ├───── CMD_VERIFY ─────────────────>│ CRC校验整个固件
  │<────── CMD_ACK 或 CMD_NACK ──────┤
  │                                  │
  ├───── CMD_REBOOT ─────────────────>│ 设置启动标志，重启
  │                                  │
  │                              [设备重启]
  │                                  │
  │                          [新固件开始运行]
```

---

## 6. 固件加密与安全

> 目标：保护固件不被窃取或篡改，提升OTA安全性。

### 6.1 为什么需要加密？

**威胁场景**：
- 🔓 固件被截获分析，泄露算法和商业机密
- 🔓 恶意固件注入，设备被攻击者控制
- 🔓 中间人攻击，固件在传输中被篡改
- 🔓 回滚攻击，强制降级到有漏洞的旧版本

### 6.2 加密方案选择

| 方案 | 安全性 | 性能 | 复杂度 | 适用场景 |
|------|-------|------|--------|---------|
| 明文传输+CRC | ⭐ | 极快 | 低 | 内部测试 |
| AES对称加密 | ⭐⭐⭐ | 快 | 中 | 通用方案 |
| RSA签名验证 | ⭐⭐⭐⭐ | 慢 | 高 | 高安全要求 |
| AES+RSA混合 | ⭐⭐⭐⭐⭐ | 中 | 高 | 金融、车载 |

### 6.3 AES加密实现

#### 6.3.1 固件加密（上位机/服务器端）

```python
# encrypt_firmware.py - 固件加密工具
from Crypto.Cipher import AES
from Crypto.Random import get_random_bytes
import struct

def encrypt_firmware(fw_data, key):
    """
    使用AES-256-CBC加密固件
    """
    # 生成随机IV（初始化向量）
    iv = get_random_bytes(16)
    
    # 填充到16字节对齐
    pad_len = 16 - (len(fw_data) % 16)
    fw_data += bytes([pad_len] * pad_len)
    
    # 加密
    cipher = AES.new(key, AES.MODE_CBC, iv)
    encrypted = cipher.encrypt(fw_data)
    
    # 返回：IV + 加密数据
    return iv + encrypted

# 使用示例
AES_KEY = bytes.fromhex('0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF')

with open('app.bin', 'rb') as f:
    fw_data = f.read()

encrypted_fw = encrypt_firmware(fw_data, AES_KEY)

with open('app_encrypted.bin', 'wb') as f:
    f.write(encrypted_fw)

print(f"加密完成，原始大小：{len(fw_data)}，加密后：{len(encrypted_fw)}")
```

#### 6.3.2 固件解密（STM32端）

```c
// aes_decrypt.c - 使用STM32硬件AES加速器
#include "stm32g4xx_hal.h"

// 密钥存储在Flash保护区域（设置读保护RDP Level 1）
const uint8_t AES_KEY[32] __attribute__((section(".key_section"))) = {
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF,
    0x01, 0x23, 0x45, 0x67, 0x89, 0xAB, 0xCD, 0xEF
};

CRYP_HandleTypeDef hcryp;

bool AES_DecryptFirmware(uint8_t *encrypted_data, uint32_t size, uint8_t *output) {
    // 提取IV（前16字节）
    uint8_t iv[16];
    memcpy(iv, encrypted_data, 16);
    
    // 配置AES
    hcryp.Instance = AES;
    hcryp.Init.DataType = CRYP_DATATYPE_8B;
    hcryp.Init.KeySize = CRYP_KEYSIZE_256B;
    hcryp.Init.pKey = (uint32_t*)AES_KEY;
    hcryp.Init.pInitVect = (uint32_t*)iv;
    hcryp.Init.Algorithm = CRYP_AES_CBC;
    
    HAL_CRYP_Init(&hcryp);
    
    // 解密（跳过前16字节IV）
    if (HAL_CRYP_Decrypt(&hcryp, (uint32_t*)(encrypted_data + 16), 
                         size - 16, (uint32_t*)output, 5000) != HAL_OK) {
        return false;
    }
    
    // 去除填充
    uint8_t pad_len = output[size - 16 - 1];
    // 实际固件大小 = 解密后大小 - 填充长度
    
    return true;
}

// OTA时先解密再写入Flash
void HandleEncryptedData(uint8_t *data, uint16_t len) {
    static uint8_t decrypt_buffer[1024];
    
    // 解密
    if (!AES_DecryptFirmware(data, len, decrypt_buffer)) {
        SendNACK(ERR_DECRYPT_FAIL);
        return;
    }
    
    // 写入Flash
    Flash_Write(g_ota.target_addr, decrypt_buffer, len - 16);
    g_ota.target_addr += (len - 16);
}
```

### 6.4 RSA签名验证（防篡改）

RSA签名确保固件来自可信源，未被篡改。

#### 6.4.1 生成密钥对（一次性操作）

```bash
# 生成2048位RSA私钥（服务器保密）
openssl genrsa -out private_key.pem 2048

# 提取公钥（烧录到设备）
openssl rsa -in private_key.pem -pubout -out public_key.pem
```

#### 6.4.2 固件签名（服务器端）

```python
# sign_firmware.py
from Crypto.PublicKey import RSA
from Crypto.Signature import pkcs1_15
from Crypto.Hash import SHA256

def sign_firmware(fw_data, private_key_path):
    # 读取私钥
    with open(private_key_path, 'rb') as f:
        private_key = RSA.import_key(f.read())
    
    # 计算固件SHA256
    h = SHA256.new(fw_data)
    
    # RSA签名
    signature = pkcs1_15.new(private_key).sign(h)
    
    return signature

# 使用示例
with open('app.bin', 'rb') as f:
    fw_data = f.read()

signature = sign_firmware(fw_data, 'private_key.pem')

# 固件包格式：固件 + 签名（256字节）
with open('app_signed.bin', 'wb') as f:
    f.write(fw_data)
    f.write(signature)
```

#### 6.4.3 签名验证（STM32端）

```c
// rsa_verify.c - 使用mbedTLS库验证签名
#include "mbedtls/rsa.h"
#include "mbedtls/sha256.h"

// 公钥（从public_key.pem提取，烧录到设备）
const uint8_t RSA_PUBLIC_KEY_N[256] = { /* 公钥模数N */ };
const uint8_t RSA_PUBLIC_KEY_E[3] = {0x01, 0x00, 0x01};  // E=65537

bool RSA_VerifySignature(uint8_t *fw_data, uint32_t fw_size, uint8_t *signature) {
    mbedtls_rsa_context rsa;
    mbedtls_rsa_init(&rsa, MBEDTLS_RSA_PKCS_V15, 0);
    
    // 设置公钥
    rsa.len = 256;
    mbedtls_mpi_read_binary(&rsa.N, RSA_PUBLIC_KEY_N, 256);
    mbedtls_mpi_read_binary(&rsa.E, RSA_PUBLIC_KEY_E, 3);
    
    // 计算固件SHA256
    uint8_t hash[32];
    mbedtls_sha256(fw_data, fw_size, hash, 0);
    
    // 验证签名
    int ret = mbedtls_rsa_pkcs1_verify(&rsa, NULL, NULL, MBEDTLS_RSA_PUBLIC,
                                       MBEDTLS_MD_SHA256, 32, hash, signature);
    
    mbedtls_rsa_free(&rsa);
    
    return (ret == 0);
}

// 接收完整固件后验证
void HandleVerifyWithSignature(void) {
    // 固件在App B区，签名在最后256字节
    uint8_t *fw_data = (uint8_t*)APP_B_ADDR;
    uint32_t fw_size = g_ota.fw_size - 256;
    uint8_t *signature = (uint8_t*)(APP_B_ADDR + fw_size);
    
    if (!RSA_VerifySignature(fw_data, fw_size, signature)) {
        SendNACK(ERR_SIGNATURE_FAIL);
        return;
    }
    
    // 签名验证通过，继续CRC校验
    uint32_t crc = CRC32_Calculate(fw_data, fw_size);
    if (crc != g_ota.fw_crc) {
        SendNACK(ERR_CRC);
        return;
    }
    
    // 更新参数并切换分区
    UpdateBootParams();
    SendACK(NULL, 0);
}
```

### 6.5 安全启动（Secure Boot）

防止启动过程被攻击。

```c
// secure_boot.c - 安全启动流程
void SecureBoot_Verify(uint32_t app_addr) {
    // 1. 读取固件签名（存储在固件末尾）
    uint32_t fw_size = GetFirmwareSize(app_addr);
    uint8_t *signature = (uint8_t*)(app_addr + fw_size - 256);
    
    // 2. 验证RSA签名
    if (!RSA_VerifySignature((uint8_t*)app_addr, fw_size - 256, signature)) {
        // 签名验证失败，拒绝启动
        Error_Handler("Invalid Signature!");
        return;
    }
    
    // 3. 检查版本号（防止回滚攻击）
    uint32_t current_version = *(uint32_t*)(app_addr + 0x200);  // 固件头中的版本号
    if (current_version < g_boot_params.min_version) {
        Error_Handler("Version Rollback Detected!");
        return;
    }
    
    // 4. 检查硬件版本兼容性
    uint8_t hw_version = *(uint8_t*)(app_addr + 0x204);
    if (hw_version != GetHardwareVersion()) {
        Error_Handler("Hardware Mismatch!");
        return;
    }
    
    // 5. 所有检查通过，跳转到应用程序
    JumpToApplication(app_addr);
}
```

---

## 7. 异常处理与容错机制

> 目标：确保OTA升级过程中出现任何问题都能恢复。

### 7.1 常见异常场景

| 异常场景 | 发生阶段 | 后果 | 恢复方案 |
|---------|---------|------|---------|
| 传输中断 | 数据接收 | 固件不完整 | 断点续传 |
| 断电 | Flash写入 | 新固件损坏 | 回滚到旧固件 |
| CRC校验失败 | 升级结束 | 固件损坏 | 拒绝切换，保留旧固件 |
| 新固件崩溃 | 启动后 | 无限重启 | 启动次数检测，自动回滚 |
| Flash擦除失败 | 准备阶段 | 无法写入 | 标记坏块，尝试其他区域 |

### 7.2 断点续传实现

传输中断后可从断点继续，无需重传。

### 7.3 启动次数检测

防止坏固件导致无限重启。

### 7.4 看门狗保护

升级过程超时自动重启。

---

## 8. 完整项目实战总结

### 8.1 项目结构

完整的OTA系统包含：
- Bootloader工程（32KB）
- Application工程（240KB）
- Python上位机工具

### 8.2 关键步骤

1. 修改链接脚本设置起始地址
2. Application的SystemInit设置VTOR偏移
3. 实现Flash读写和校验功能
4. 编写通信协议处理
5. 开发上位机升级工具

---

## 9. 总结与最佳实践

### 9.1 OTA系统检查清单

- ✅ 双应用区设计，确保可回滚
- ✅ CRC32 + RSA签名双重验证
- ✅ 断点续传 + 启动计数检测
- ✅ 固件加密 + 安全启动
- ✅ 日志记录升级过程
- ✅ 看门狗保护防死锁
- ✅ 版本管理防回滚

### 9.2 常见问题

| 问题 | 原因 | 解决方案 |
|------|------|---------|
| 跳转后HardFault | VTOR未设置 | 检查Application的SystemInit |
| Flash写入失败 | 未对齐/未擦除 | 检查地址对齐和擦除操作 |
| CRC校验失败 | 数据损坏 | 统一CRC算法 |
| 无限重启 | 新固件有Bug | 启用启动计数自动回滚 |

### 9.3 性能优化

1. 使用DMA传输减少CPU占用
2. 硬件CRC加速比软件快10倍
3. Flash并行擦除边接收边擦除
4. 压缩固件减少50%传输时间
5. 断点续传网络中断无需重传

---

**学习路径回顾**：
```
理解启动流程 → Flash分区设计 → 编写Bootloader → 
Flash操作 → 通信协议 → 固件校验 → 加密安全 → 
异常处理 → 完整项目实战
```

通过本笔记，你已掌握STM32 OTA升级的完整技术栈！

**参考资料**：
- AN2606: STM32 system memory boot mode
- AN4657: STM32 in-application programming
- UM2552: STM32Cube MCU Package examples
- NIST FIPS 197: Advanced Encryption Standard



感谢阅读，我们下篇见。



**本页面更新于: 2026年7月10日 10:35:35**
