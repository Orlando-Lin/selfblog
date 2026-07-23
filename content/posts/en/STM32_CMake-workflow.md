---
title: STM32 CMake Environment Setup
description: When Keil is not an option, VS Code + CMake + GCC is the most recommended workflow.
date: 2026-07-14
category: Tech
tags: [STM32, Environment, Learning, Embedded, CMake, GCC]
cover: https://assets.virongx.com/blog/covers/STM32_CMake工作流.png
---

# STM32 CMake Workflow

## 1 [Environment Setup](https://gnutoolchains.com/)

The first step is to configure the toolchain.

[Visual Studio Code](https://code.visualstudio.com/): Microsoft’s lightweight code editor; with extensions it can match IDE-level workflows.

Recommended extensions:
- Cortex-Debug (VS Code debug)
- CMake Tools
- ARM Assembly (assembly syntax highlighting)

[GNU Arm Embedded Toolchain](https://developer.arm.com/downloads/-/arm-gnu-toolchain-downloads): Official ARM Cortex-M cross compiler (`arm-none-eabi-gcc`).

[CMake](https://cmake.org/download/): Cross-platform build-system generator—it defines which files exist and how to compile them.

[Ninja](https://github.com/ninja-build/ninja/releases?utm_source=chatgpt.com): Build tool.

[OpenOCD](https://github.com/xpack-dev-tools/openocd-xpack/releases/?utm_source=chatgpt.com) / [J-Link](https://www.segger.com/downloads/jlink/?utm_source=chatgpt.com) / [ST-Link](https://www.st.com/en/development-tools/stsw-link009.html): Software for debug and flash over your probe.

STM32CubeMX (optional): ST’s peripheral config tool; can generate startup code.

## 2 Verify the Environment

```bash
arm-none-eabi-gcc --version
cmake --version
ninja --version
openocd --version
```

If all print versions, **PATH** is configured correctly.

## 3 CubeMX: Generate a CMake Project

Basic MCU setup is omitted here—configure as shown below and generate the project.

![CMake_CubeMX (1)](https://assets.virongx.com/blog/posts/2026/STM32_CMake工作流/CMake_CubeMX (1).png)

![CMake_CubeMX (2)](https://assets.virongx.com/blog/posts/2026/STM32_CMake工作流/CMake_CubeMX (2).png)

## 4 Configure VS Code

### 1 First-time CMake configure

Ctrl+Shift+P → **CMake: Configure** → **Add a New Preset...** → **Create from Compilers**

It scans compilers on your machine (e.g. `arm-none-eabi-gcc.exe`) and generates `CMakePresets.json`.

**CMakePresets.json overview**

```json
{
    "version": 8,			// File version; depends on your installed CMake version
    "configurePresets": [	// Base configure preset; you can add Debug/Release presets later
        {
            "name": "GCC 15.2.1 arm-none-eabi",		// Preset name
            "displayName": "GCC 15.2.1 arm-none-eabi",	// Name shown in VS Code
            "description": "Using compilers: C = c:\\SysGCC\\arm-eabi\\bin\\arm-none-eabi-gcc.exe, CXX = c:\\SysGCC\\arm-eabi\\bin\\arm-none-eabi-g++.exe",	// Description
            "binaryDir": "${sourceDir}/out/build/${presetName}",   // *All build outputs go here
            "cacheVariables": {		// Equivalent to command-line -D flags
                "CMAKE_INSTALL_PREFIX": "${sourceDir}/out/install/${presetName}",	// `cmake --install` target directory
                "CMAKE_C_COMPILER": "c:/SysGCC/arm-eabi/bin/arm-none-eabi-gcc.exe",		// C compiler for CMake
                "CMAKE_CXX_COMPILER": "c:/SysGCC/arm-eabi/bin/arm-none-eabi-g++.exe",	// C++ compiler
                "CMAKE_BUILD_TYPE": "Debug"	// -O0 -g for debugging; Release uses -O2 with no debug info
            }
        }
    ]
}
```

**`CMakePresets.json` is a one-click config for CMake**—it pins configure arguments so every machine uses the same settings.

Without it, you would run something like this every time:

```bash
cmake -S . -B build \
    -G Ninja \
    -DCMAKE_BUILD_TYPE=Debug \
    -DCMAKE_TOOLCHAIN_FILE=toolchain.cmake
```

### 2 Select Kit = toolchain

Ctrl+Shift+P → **CMake: Select Configure Preset** → pick the scanned compiler.

## 5 Build

Run **CMake: Build** or click **Build** in the status bar. Flow: cmake → ninja → gcc.

`out/build/` produces **elf**, **hex**, and **bin**.

Pipeline: `.c` → gcc → `.o` → link → ELF → objcopy → HEX → objcopy → BIN

### 1 `.elf`

ELF is the core artifact in the GCC/Linux world.

It contains: code, data, symbols, variable names, function names, debug info, and section addresses.

Sections like `.text`, `.data`, `.bss`, `.symtab`, `.strtab`, `.debug_info`, `.debug_line`, `.debug_abbrev` all live inside.

```
.text
08000100
Motor_Update()
```

GDB can map `0x08000100` to `Motor_Update()`. **Debugging requires the ELF.**

### 2 `.hex`

Addressed binary (Intel HEX).

Lines like `:10000000 55AAFF3344... CC` include length, address, data, and checksum.

### 3 `.bin`

Raw binary—smallest size.

No embedded address; the flasher needs a start address.

### **Troubleshooting**

#### 1 CMake environment

```
Bad CMake executable: "". Check to make sure it is installed or the value of the "cmake.cmakePath" setting contains the correct path
```

First, in the **VS Code terminal**, run `cmake --version`.

If you see “cmake is not recognized”, **CMake is not on PATH**. Reconfigure PATH or restart VS Code and close all windows.

If the terminal works, check whether VS Code still cannot find CMake.

Ctrl+Shift+P → **Preferences: Open Settings (JSON)** and look for:

```json
{
    "cmake.cmakePath": ""	// "C:/Program Files/CMake/bin/cmake.exe"
}
```

Set it to the real path; use `where cmake` to locate it.

#### 2 Ninja environment

```
'nmake' '-?'
failed with:
no such file or directory
```

The generator should be **Ninja**, not NMake.

Edit **CMakePresets.json**:

```
{
    "version": 8,
    "configurePresets": [
        {
            "name": "GCC 15.2.1 arm-none-eabi",
            "generator": "Ninja",	// Add this line
        }
    ]
}
```

#### 3 Toolchain configuration

A normal CubeMX CMake project should load a toolchain file before `project()`, e.g.:

```CMake
set(CMAKE_TOOLCHAIN_FILE cmake/gcc-arm-none-eabi.cmake)
```

Or in `CMakePresets.json`:

```json
"toolchainFile": "${sourceDir}/cmake/gcc-arm-none-eabi.cmake"
```

## 6 Configure Cortex-Debug

Create `.vscode/launch.json` (ST-Link example):

```
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "STM32 Debug",
            "cwd": "${workspaceFolder}",
            "executable": "${workspaceFolder}/out/build/bootloader_V001.elf",  // Path to the built ELF
            "request": "launch",
            "type": "cortex-debug",
            "servertype": "openocd",	// ST-Link: keep openocd; J-Link also supported
            "device": "STM32G474RE",	// MCU part number
            "configFiles": [
                "interface/stlink.cfg",
                "target/stm32g4x.cfg" 	// Replace with your target
            ],
            "armToolchainPath": "C:/SysGCC/arm-eabi/bin",	// arm-none-eabi tools without relying on PATH
            "openOCDPath" : "D:/Tools/xpack-openocd-0.12.0-7-win32-x64/xpack-openocd-0.12.0-7/bin/openocd.exe",	// OpenOCD path
        }
    ]
}
```

Adjust paths for your OpenOCD install or environment variables.

## 7 Finish

**Debug:** F5

**Flash:** VS Code does **not** flash automatically.

**Option 1:** F5 — Build → OpenOCD → download ELF → reset → stop at `main()`.

**Option 2:** STM32CubeProgrammer — build → Download in CubeProgrammer.

```bash
# One-liner flash via CLI
STM32_Programmer_CLI.exe \
-c port=SWD \
-w build/RobotHand.hex \
-rst
```

**Option 3:** Flash only, no debug:

```bash
openocd ^
-f interface/stlink.cfg ^
-f target/stm32g4x.cfg ^
-c "program out/build/bootloader_V001.elf verify reset exit"
```

> [!NOTE]
>
> `-c` means: run one OpenOCD command.
>
> `program`: download the file to MCU Flash = download `out/build/bootloader_V001.elf`.
>
> `out/build/bootloader_V001.elf`: build output.
>
> `verify`: read back from Flash and compare; on mismatch (bad contact, failed download, damaged Flash) OpenOCD reports **Verify Failed**.
>
> `reset`: reset the MCU.
>
> `exit`: quit OpenOCD (otherwise it keeps listening on port 3333).

**Option 4:** VS Code one-click flash task — `.vscode/tasks.json`:

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

Then **Terminal → Run Task**.



**Last updated: July 20, 2026 23:45:35**
