---
title: STM32_CMake环境搭建
description: 因特殊原因无法使用keil时，VS Code + CMake + GCC工作流最为推荐
date: 2026-07-14
category: 技术
tags: [STM32, 环境, 学习, 嵌入式, CMake, GCC]
cover: https://assets.virongx.com/blog/covers/STM32_CMake工作流.png
---

# STM32_CMake工作流

## 1 [环境搭建](https://gnutoolchains.com/)

要使用该工作流第一件事就是要配置好环境。

[Visual Studio Code](https://code.visualstudio.com/) ：微软推出的轻量级代码编辑器，通过丰富的插件系统实现IDE级功能

插件推荐：Cortex-Debug (VS Code 调试插件)

​		   CMake Tools

​		   ARM Assembly (汇编语言高亮)

[GNU Arm Embedded Toolchain](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads) ：官方维护的ARM Cortex-M交叉编译工具链（arm-none-eabi-gcc）

[CMake](https://cmake.org/download/) ：跨平台的构建系统生成器,生成构建规则，告诉电脑"这个工程有哪些文件、怎么编译"。

[Ninja](https://github.com/ninja-build/ninja/releases?utm_source=chatgpt.com)：构建（Build）工具

[OpenOCD](https://github.com/xpack-dev-tools/openocd-xpack/releases/?utm_source=chatgpt.com)/[J-Link](https://www.segger.com/downloads/jlink/?utm_source=chatgpt.com)/[ST-Link](https://www.st.com/en/development-tools/stsw-link009.html)工具 ：用于调试和烧录的硬件接口软件

STM32CubeMX （可选）：ST官方外设配置工具，可生成启动代码

## 2 检查环境

```bash
arm-none-eabi-gcc --version
cmake --version
ninja --version
openocd --version
```

如果都能正常显示版本，说明 **PATH** 配置没问题。

## 3 CubeMX 设置生成 CMake 工程

基础配置就不再做过多赘述，按如下图配置，并生成项目。

![CMake_CubeMX (1)](https://assets.virongx.com/blog/posts/2026/STM32_CMake工作流/CMake_CubeMX (1).png)

![CMake_CubeMX (2)](https://assets.virongx.com/blog/posts/2026/STM32_CMake工作流/CMake_CubeMX (2).png)

## 4 配置VSCode

### 1 第一次配置 CMake

Ctrl+Shift+P → 输入CMake: Configure → Add a New Preset... → Create from Compilers 

它会扫描你电脑上的编译器（例如 `arm-none-eabi-gcc.exe`），然后自动生成一个 `CMakePresets.json`。

**CMakePresets.json 介绍**

```json
{
    "version": 8,			//文件版本，与你安装的 CMake 版本有关
    "configurePresets": [	//基础配置项，以后还可以加Debug/Release等多个配置项
        {
            "name": "GCC 15.2.1 arm-none-eabi",		//这是 Preset 的名字
            "displayName": "GCC 15.2.1 arm-none-eabi",	//VScode 显示名字
            "description": "Using compilers: C = c:\\SysGCC\\arm-eabi\\bin\\arm-none-eabi-gcc.exe, CXX = c:\\SysGCC\\arm-eabi\\bin\\arm-none-eabi-g++.exe",	//说明
            "binaryDir": "${sourceDir}/out/build/${presetName}",   //*所有编译生成的东西放这里
            "cacheVariables": {		//相当于命令行
                "CMAKE_INSTALL_PREFIX": "${sourceDir}/out/install/${presetName}",	//以后执行cmake --install，安装目录就是这
                "CMAKE_C_COMPILER": "c:/SysGCC/arm-eabi/bin/arm-none-eabi-gcc.exe",		//告诉CMake使用哪个编译器
                "CMAKE_CXX_COMPILER": "c:/SysGCC/arm-eabi/bin/arm-none-eabi-g++.exe",	//同理C++的编译器
                "CMAKE_BUILD_TYPE": "Debug"	//表示-O0 -g方便调试	；Release 就是 -O2无调试信息
            }
        }
    ]
}
```

`**CMakePresets.json` 可以理解为 CMake 工程的“一键配置文件”**，它的作用就是**把 Configure 时需要的各种参数固定下来**，这样每个人、每台电脑都能用相同的配置来编译

假设没有 `CMakePresets.json`，你每次都要执行类似命令：

```bash
cmake -S . -B build \
    -G Ninja \
    -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_TOOLCHAIN_FILE=toolchain.cmake
```

### 2 选择Kit= 编译工具链（Toolchain）

Ctrl+Shift+P → 输入CMake: Select Configure Preset→ 扫描到的编译器 

## 5 Build编译

输入：CMake: Build OR 点击底部Build 执行顺序cmake → ninja → gcc

out/build/生成三个文件 elf/hex/bin     

编译过程：.c → gcc → .o → Link → ELF → objcopy → HEX → objcopy → BIN

### 1 .elf ：

ELF 是 Linux 和 GCC 世界最重要的文件。

里面包含 ：代码 数据 符号 变量名 函数名 调试信息 地址 Section。

实际 .text .data .bss .symtab .strtab .debug_info .debug_line .debug_abbrev 这些段全在里面。

```
.text
08000100
Motor_Update()
```

GDB 就能知道，这里是Motor_Update()。**所以调试必须要elf！！**

### 2 .hex ：

带地址的bin。

:10000000 55AAFF3344... CC，里面一般记录长度，地址，数据，校验。

### 3 .bin ：

纯二进制，体积最小。

问题就是没有地址，不知道往哪烧写。所以下载时需要告诉起始地址。

### **报错：**

#### 1 CMake环境问题

```
Bad CMake executable: "". Check to make sure it is installed or the value of the "cmake.cmakePath" setting contains the correct path
```

首先：**VS Code 终端 **执行 cmake --version

提示 'cmake' 不是内部或外部命令；说明 **CMake 没有加入 PATH**。从新配环境变量或者重启VScode关闭所有页面。

其次：先检查cmake --version是否有输出；有版本信息输出，可能VS Code 找不到

Ctrl+Shift+P → Preferences: Open Settings (JSON) →查看是否有该块

```json
{
    "cmake.cmakePath": ""	//"C:/Program Files/CMake/bin/cmake.exe"
}
```

改为正常路径可以where cmake查看。

#### 2 Ninja环境问题

```
'nmake' '-?'
failed with:
no such file or directory
```

Generator 应该是 Ninja，而不是 NMake

修改你的 **CMakePresets.json**

```
{
    "version": 8,
    "configurePresets": [
        {
            "name": "GCC 15.2.1 arm-none-eabi",
            "generator": "Ninja",	//添加这一行
        }
    ]
}
```

#### 3 工具链Toolchain 配置问题

正常 STM32CubeMX 生成的 CMake 工程应该会在 `project()` 之前加载一个 Toolchain 文件，例如：

```CMake
set(CMAKE_TOOLCHAIN_FILE cmake/gcc-arm-none-eabi.cmake)
```

或者在 CMakePresets.json 中指定：

```json
"toolchainFile": "${sourceDir}/cmake/gcc-arm-none-eabi.cmake"
```

## 6 配置Cortex-Debug

创建 .vscode/launch.json，例如 ST-Link：

```
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "STM32 Debug",
            "cwd": "${workspaceFolder}",
            "executable": "${workspaceFolder}/out/build/bootloader_V001.elf",  //编译生成的ELF文件位置
            "request": "launch",
            "type": "cortex-debug",
            "servertype": "openocd",	//ST-Link保持openocd/jlink
            "device": "STM32G474RE",	//芯片型号
            "configFiles": [
                "interface/stlink.cfg",
                "target/stm32g4x.cfg" 	//替换成自己芯片型号
            ],
            "armToolchainPath": "C:/SysGCC/arm-eabi/bin",	//arm-none-eabi 这样不用依赖 PATH。
            "openOCDPath" : "D:/Tools/xpack-openocd-0.12.0-7-win32-x64/xpack-openocd-0.12.0-7/bin/openocd.exe",	//也不用找 gcc。
        }
    ]
}
```

这里需要根据你的 OpenOCD 安装路径或环境变量适当调整。

## 7 Finish

调试F5

烧录：VSCode **不会自动烧录**

一、是通过F5直接Build → OpenOCD → 下载 ELF → Reset → 停在 main()；

二、是通过STM32CubeProgrammer 编译 → CubeProgrammer → Download；

```bash
#也可用此做一键烧录
STM32_Programmer_CLI.exe \
-c port=SWD \
-w build/RobotHand.hex \
-rst
```

三、只烧录不调试

```bash
openocd ^
-f interface/stlink.cfg ^
-f target/stm32g4x.cfg ^
-c "program out/build/bootloader_V001.elf verify reset exit"
```

> [!NOTE]
>
> -c的意思就是 ：command（执行一条 OpenOCD 命令）
>
> program : 告诉 OpenOCD把这个文件下载到 MCU Flash = 下载 out/build/bootloader_V001.elf
>
> out/build/bootloader_V001.elf:编译的结果
>
> verify :下载完成以后，再从Flash读回来比较；如果有错误(Flash损坏/下载失败/接触不好)OpenOCD报：Verify Failed
>
> reset : 执行 MCU Reset
>
> exit : 如果没有OpenOCD 会一直：Listening on port 3333不退出。

四、VScode快捷一键烧录

.vscode/tasks.json

```json
{
    "label": "Flash",
    "type": "shell",
    "command": "openocd",
    "args": [
        "-f",
        "interface/stlink.cfg",
        "-f",
        "target/stm32g4x.cfg",
        "-c",
        "program out/build/bootloader_V001.elf verify reset exit"
    ]
}
```

直接Terminal Run Task



**本页面更新于: 2026年7月20日 23:45:35**