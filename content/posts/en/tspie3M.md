---
title: Taishan Pi 3M-RK3576 Overview
description: "A brief resource guide for the Taishan Pi 3M-RK3576 (source: https://wiki.lckfb.com/zh-hans/tspi-3-rk3576/open-source-hardware/)"
date: 2026-07-05
category: Tech
tags: [Taishan Pi, RK3576, Hardware, SBC, Learning, Linux]
cover: https://assets.virongx.com/blog/covers/tspie3M.png
---

# Taishan Pi Board Overview

## Contents

- [Resource Map](#resource-map)
- [Hardware Specs](#hardware-specs)
- [Expansion Interfaces](#expansion-interfaces)

## Resource Map

![Resource map](https://assets.virongx.com/blog/posts/2026/tspie3M/资源标注.png)

## Hardware Specs

| Item | Specification |
| :--- | :--- |
| **CPU** | Rockchip RK3576, octa-core 64-bit (4×Cortex-A72 + 4×Cortex-A53), up to 2.2 GHz |
| **GPU** | ARM Mali-G52 MC3; OpenCL 2.2, Vulkan 1.1 |
| **NPU** | Up to 6 TOPS |
| **VPU** | 8K@30fps H.265/VP9/AV1/AVS2 decoder |
| **RAM** | **4GB** / 8GB / 16GB LPDDR5 |
| **Storage** | 32GB / **64GB** / 128GB eMMC (optional) |
| **Video out** | HDMI 2.1 (8K@60 or 4K@120), DP 1.4 (8K@30), MIPI-DSI (4K@60) |
| **Video in** | MIPI-CSI (48M pixel) |
| **Audio** | 3.5mm jack, mic in, HDMI audio |
| **Ethernet** | 10/100/1000 Mbps RJ45 |
| **Wireless** | WiFi 6 (802.11 ax/ac/a/b/g/n), Bluetooth 5.0 |
| **USB** | 1× USB 3.0, 3× USB 2.0, 1× Type-C (OTG/DP) |
| **Expansion** | 40-pin GPIO (Raspberry Pi compatible): UART, I2C, SPI, PWM, ADC, etc. |
| **Power** | DC 5V/3A (Type-C) |
| **OS** | Android 12, Debian 11, Ubuntu 20.04/22.04, Buildroot |
| **Size** | 85mm × 56mm |

## Expansion Interfaces

![40-pin header](https://assets.virongx.com/blog/posts/2026/tspie3M/40pin拓展接口.png)

The onboard **40-pin GPIO header** (Raspberry Pi pinout compatible) exposes:

| Interface | Count / Pins | Notes |
| :--- | :--- | :--- |
| **Power** | 5V, 3.3V, GND | Power and ground for peripherals |
| **UART** | 1 group | Async serial |
| **I2C** | 2 groups | Sensors, displays, etc. |
| **SPI** | 1 group | CLK, MOSI, MISO, CS |
| **CAN** | 1 group | CAN_RX, CAN_TX |
| **PWM** | 2 channels | Motors, LED dimming, etc. |
| **ADC** | 2 channels | Analog inputs |
| **GPIO** | 14 pins | General-purpose I/O |

Thanks for reading — see you in the next post.
