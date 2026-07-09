---
title: 泰山派3M-RK3576简介
description: 泰山派3M-RK3576的资源简介(来源于：https://wiki.lckfb.com/zh-hans/tspi-3-rk3576/open-source-hardware/)
date: 2026-07-05
category: 技术
tags: [泰山派, RK3576, 硬件, 开发板, 学习, Linux]
cover: https://assets.virongx.com/blog/covers/tspie3M.png
---

# 泰山派开发板概况

## 目录

- [资源标注](#资源标注)
- [硬件参数](#硬件参数)
- [扩展接口](#扩展接口)

## 资源标注

![资源标注](https://assets.virongx.com/blog/posts/2026/tspie3M/资源标注.png)

## 硬件参数

| 项目 | 规格 |
| :--- | :--- |
| **处理器 (CPU)** | Rockchip RK3576，八核 64 位（4×Cortex-A72 + 4×Cortex-A53），主频高达 2.2GHz |
| **图形处理器 (GPU)** | ARM Mali-G52 MC3；支持 OpenCL 2.2、Vulkan 1.1 |
| **算力 (NPU)** | 算力高达 6TOPS |
| **视频处理 (VPU)** | 8K@30fps H.265/VP9/AV1/AVS2 decoder |
| **内存 (RAM)** | **4GB** / 8GB / 16GB /LPDDR5 |
| **存储 (eMMC)** | 32GB / **64GB** / 128GB eMMC（选配） |
| **视频输出** | HDMI 2.1（8K@60Hz 或 4K@120Hz）、DP 1.4（8K@30Hz）、MIPI-DSI（4K@60Hz） |
| **视频输入** | MIPI-CSI 4Lane摄像头接口*3 |
| **音频** | 3.5mm(声音输出+麦克风输入)、板载麦克风 |
| **以太网** | 10/100/1000Mbps RJ45 网口 |
| **无线网络** | WiFi （2.4GHz&5GHz）、Bluetooth 5.2 |
| **卡座** | TF+SIM二合一卡座，可以同时支持SIM卡和Micro SD（TF）卡 |
| **Mini-PCle接口** | 支持PCle-WiFi、4G模块和mSATA |
| **USB** | 1× USB 3.0 Type-A、3× USB 2.0 Type-A、1× Type-C（OTG/DP） |
| **拓展接口** | 40-pin GPIO 接口（兼容树莓派），包含 UART、I2C、SPI、PWM、ADC 等，FAN(5V) |
| **供电** | DC 5V/3A（Type-C） |
| **操作系统** | Android 12、Debian 11、Ubuntu 20.04/22.04、Buildroot |
| **尺寸** | 85mm × 56mm |

## 扩展接口

![40pin拓展接口](https://assets.virongx.com/blog/posts/2026/tspie3M/40pin拓展接口.png)

板载 **40Pin GPIO 扩展排针**（兼容树莓派引脚定义），可引出以下信号类型：

| 接口类型 | 数量 / 引脚 | 说明 |
| :--- | :--- | :--- |
| **电源 (Power)** | 5V、3.3V、GND | 为外设模块提供供电与接地 |
| **UART** | 1 组 | 通用异步串口，用于串行通讯 |
| **I2C** | 2 组 | I2C 总线，可连接传感器、显示屏等外设 |
| **SPI** | 1 组 | 高速串行外设接口（CLK、MOSI、MISO、CS） |
| **CAN** | 1 组 | CAN 总线通讯（CAN_RX、CAN_TX） |
| **PWM** | 2 路 | 脉冲宽度调制，可用于电机控制、LED 调光等 |
| **ADC** | 2 路 | 模拟数字转换输入 |
| **GPIO** | 14 个 | 通用可编程输入/输出引脚 |



感谢阅读，我们下篇见。



**本页面更新于: 2026年7月10日 00:02:35**