---
title: System-Level ESD Protection
description: Device- vs system-level ESD, clamp voltage and TLP math, PCB discharge paths, and per-interface selection—written so it can be used on a schematic and in layout.
date: 2026-11-16
category: Tech
tags: [ESD, Hardware, Embedded, Interface, Learning]
cover: https://assets.virongx.com/blog/covers/系统级 ESD 保护.png
---

> System-level ESD, in one sentence: give the strike a low-inductance path to ground before it reaches the IC, and keep whatever voltage remains under the downstream absolute maximum rating. The IEC number on a diode only says the diode survives—not that your product passes.

# System-Level ESD Protection

## Before we start

This note answers one engineering question: **your product has to pass IEC 61000-4-2—how do you choose the ESD diode next to each connector, where do you put it, and how do you prove it works?**

It is ordered "picture first, numbers second". §1–3 build the physical picture: where the strike travels, why on-chip protection is not enough, and what the external part actually does. §4–5 take the parameters apart, with clamping voltage as the centre. §6 puts the return path into the PCB. §7 is a per-interface checklist. §8 is the full workflow, §9 is debugging.

The primary source is TI's [*System-Level ESD Protection Guide* (SSZB130E, August 2025)](https://www.ti.com/); the hardware-side discussion is in [this WeChat article](https://mp.weixin.qq.com/s/pJFYR1YsTd-GmgD5l3lBDA). The figures are taken from the TI guide and keep its original numbering (which is why they jump from 1-x to 3-x), with the labels and numbers left intact. Part numbers change—**use the current datasheet**.

## Contents

- [Before we start](#before-we-start)
- [1 What the strike is actually doing](#1-what-the-strike-is-actually-doing)
- [2 Why on-chip ESD is not enough](#2-why-on-chip-esd-is-not-enough)
- [3 How the external diode works](#3-how-the-external-diode-works)
- [4 Parameters: which failure each number prevents](#4-parameters-which-failure-each-number-prevents)
- [5 Clamping voltage and 16 A TLP](#5-clamping-voltage-and-16-a-tlp)
- [6 PCB: the nanosecond current path](#6-pcb-the-nanosecond-current-path)
- [7 Per-interface design](#7-per-interface-design)
- [8 Workflow from schematic to a passing test](#8-workflow-from-schematic-to-a-passing-test)
- [9 Failures and debug](#9-failures-and-debug)
- [10 Summary](#10-summary)
- [Appendix: glossary](#appendix-glossary)

## 1 What the strike is actually doing

ESD is charge transfer on a nanosecond scale. On a doorknob the energy is irrelevant; on an IC pin, the same charge has to squeeze into a few square microns of junction in a few nanoseconds, and the instantaneous voltage and current are enough to destroy it.

Two kinds of damage:

- **Soft fail**: reset, hang, dropped link. The part is intact, but the function was interrupted; a power cycle may recover it.
- **Hard fail**: oxide rupture, metal fuse, a permanently dead I/O. No recovery.

Charge does not appear on the die by itself—it has to enter through something a person can touch. The real entry points are the **exposed** ones: connectors, keys, antennas, card cages, chassis seams, industrial terminals. Charge on a human always lands there first, then travels along the copper.

With no external protection, there is only one path:

```
gun / human → connector → PCB trace → IC pin → inside the die → ground
```

With an external ESD diode, correctly placed:

```
gun / human → connector → ESD diode → ground plane (bulk of the energy)
                              └─ residual voltage → downstream IC
```

The two pictures:

![Figure 1-1 ESD current path with no protection: everything goes through the IC](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-1-1-without-protection.png)

The red arrow in Figure 1-1 is the current: in through the connector, along the trace, straight through the IC, then out through the IC's ground pin. **The IC sits in the middle of the current path** and sees the full drop along it.

![Figure 1-2 With a shunt ESD diode: the current turns to ground at the connector](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-1-2-with-protection.png)

Figure 1-2 changes one thing: a diode in parallel between the connector and the IC, cathode on the signal, anode on ground. The red arrow turns to ground at the diode; only a clamped sliver is left on the IC side. That is the physical meaning of system-level protection—**not making the IC stronger, but keeping most of the charge out of it**.

How concrete is the difference? Same trace, same gun, one scope probe:

![Figure 1-3 Voltage at one test point: no diode vs diode](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-1-3-waveforms.png)

Read Figure 1-3 for three things: the x-axis is nanoseconds (the whole event is over in tens of ns), the y-axis is volts, and the two traces are the same point with and without the diode. The red trace peaks above 300 V around 5 ns, then rings down through more than a hundred volts negative; the blue trace stays under 40 V and is essentially flat.

**The downstream chip sees this voltage, not the 8 kV on the gun.** So schematic review is not "is there a TVS?" It is three questions:

1. Where does this current enter, and where does it return?
2. Does the return cross anything it should not (IC ground, crystal ground, reset ground)?
3. How many volts remain at the IC pin?

You are protecting silicon, not the kV printed on the part.

## 2 Why on-chip ESD is not enough

### 2.1 Do not mix the two standards

| | Device-level | System-level |
| --- | --- | --- |
| Typical specs | HBM, CDM (IC datasheet ESD box) | IEC 61000-4-2 (product immunity) |
| When | Wafer, package, shipping, SMT | ESD gun on a finished unit's ports/chassis |
| Energy | Low | An order of magnitude higher |
| What it proves | The component survives handling | The product interface survives a specified system hit |

The last row is the one people skip: the two tests **do not measure the same thing**. HBM/CDM answer "will this chip die between the fab and the pick-and-place machine?" IEC answers "will this board, built into a product, die when someone fires a gun at its connector?" One is component reliability, the other is product immunity—they are not interchangeable.

The three models, roughly:

- **HBM (human body model)**: a charged person touching a device. Typically 100 pF through 1.5 kΩ—ampere-level current lasting one to two hundred nanoseconds.
- **CDM (charged device model)**: the device itself charged during handling, then discharging to ground. Sub-nanosecond rise, peaks of ten-plus amps, but little total charge.
- **IEC 61000-4-2**: a person holding a metal object discharging into the product. Typically 150 pF / 330 Ω—about 30 A first peak at 8 kV contact, followed by a tail hundreds of nanoseconds long, i.e. an order of magnitude more energy than the other two.

Put the three on one time axis and it is obvious:

![Figure 1-4 IEC vs CDM vs HBM current waveforms](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-1-4-iec-cdm-hbm.png)

On a 48 A scale, HBM hugs the zero line, CDM is a needle-thin spike, and only the IEC waveform has both a tens-of-amps peak and a tail stretching past 100 ns. That is the first reason "the component passed, the product still failed": **the pulses are not remotely the same.**

The second reason is that it does not fit. Figure 1-5 shows the same pad:

![Figure 1-5 Silicon area for system-level (8 kV IEC) vs device-level (2 kV HBM) protection on one pad](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-1-5-die-area.png)

On the left, the protection structure needed to take 8 kV IEC spread around the pad; on the right, what 2 kV HBM costs. Not a few percent—a multiple. At advanced nodes, thinner oxides and finer metal make the same class of protection cost even more area; that area is money, and it brings parasitic capacitance that drags down the I/O's high-frequency behaviour. Building system-level protection into an MCU or core chipset is therefore increasingly unattractive, electrically and commercially—**discrete parts at the connector are the main path**, not something "2 kV HBM in the datasheet" lets you skip.

### 2.2 IEC 61000-4-2 numbers you will use

Level 4 is the usual bar:

| Method | Voltage | Meaning |
| --- | --- | --- |
| Contact | 8 kV | Tip on metal: shells, connector bodies, accessible metal |
| Air | 15 kV | Across a gap onto plastic keys, seams, insulators |

The 8 kV contact current waveform: first peak about **30 A**, rise about **0.8 ns**, a quick fall back to the mid-teens of amps, then a tail a few hundred nanoseconds long. Everything downstream follows from that shape:

- **You cannot compare clamping against 30 A DC.** A part's response to a 0.8 ns front has nothing to do with its DC behaviour; you need the dynamic curve (§5, TLP).
- **The energy is in the first tens of nanoseconds**, so how short and how low-inductance the return path is often decides the outcome more than the part's headline rating.

Air discharge is a higher voltage but repeatability suffers (gap, humidity, surface), so it is mostly useful for exposing structural problems like arcing across a seam. Both methods must meet their rated level.

> A 30 kV contact rating on the **component** is a fixture result. Board inductance, return ground, and mechanics can still fail the product at 8 kV.

## 3 How the external diode works

The "ESD diode" at a connector is usually a silicon TVS (transient voltage suppressor): one avalanche diode (unidirectional) or two in series opposition (bidirectional), placed **in parallel** between the net and the reference ground.

It has exactly three jobs:

| Phase | Device | Design constraint |
| --- | --- | --- |
| Idle | Off, leakage only | `VRWM` ≥ max operating signal; leakage must not corrupt levels or the eye |
| Strike | Avalanche, low-Z to ground | Survives the IEC class; dynamic clamp below downstream abs-max |
| After | Returns off | No latch-up, no stuck leakage |

**Idle**: it has to be invisible. Only a small leakage `IR` flows; it must not shift a DC level, add noise to an analog channel, or become quiescent drain in a battery product.

**Strike**: past breakdown `VBR` the impedance collapses within picoseconds to nanoseconds and the current is diverted. Two things must hold at once—the part survives (its IEC rating) and the clamped voltage stays under the downstream abs-max (§5).

**After**: it must return cleanly to off. No latch-up, no lingering leakage. This one is easy to forget until production notices that zapped boards draw more current.

### 3.1 Signal integrity: what the shunt capacitance does

Because it is in parallel, the ESD part is also a capacitance to ground. Estimate the current it steals on an edge:

```
i = C · dv/dt
```

1 pF, 3.3 V, 1 ns edge → about 3.3 mA. Not much as a current, but it is taken exactly where the edge is steepest, so it behaves like loading the trace: impedance shifts, the edge slows, return loss rises. On a 5–20 Gbps link, a few tenths of a pF plus a short stub is enough to fail the eye.

Selection priority therefore moves with speed: **slow nets: voltage window and clamp first. Fast nets: capacitance and package routing rank with the IEC rating.**

### 3.2 Placement

From the connector toward the IC:

```
connector → ESD diode (closest) → optional CM choke / small series R / EMI → IC
```

One rule: **the ESD part must be the first nonlinear element the pulse sees.**

A series resistor placed *between* connector and ESD dumps the pulse into the resistor and the IC, and the diode never gets its chance. High-speed diffs generally cannot take a large series R (impedance and eye). Slow GPIO and keys may use 22–100 Ω **after** the ESD part to cut the residual reaching the MCU—budget the delay and the drive.

TI's flow-through package solves a layout problem: signal in one side, out the other, clamp to ground in the middle. The fast trace passes *through* the part instead of stubbing off and coming back.

![Figure 1-6 Pass-through routing: each differential pair enters and leaves under the package, GND drops to the plane in between](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-1-6-passthrough.png)

In Figure 1-6 every pair (D0±, D1±, D2±, Clk±) runs in-under-out beneath the package, with ground vias right next to it. No stub, no doubling back, minimum loop area. That is also why adding ESD late is less painful with a flow-through part.

## 4 Parameters: which failure each number prevents

Higher kV is not the selection function. Each spec blocks a different failure; misread one and you miss a failure class.

### 4.1 VRWM

`VRWM` is the highest reverse voltage at which the part is guaranteed off—the leakage in the datasheet is specified there. Normal operation (tolerance, overshoot, common mode included) must stay below it, otherwise you leak or partially clamp in traffic: bit errors, distorted analog channels, higher battery drain.

```
VRWM ≥ V_signal,max    (protocol overshoot, CM, supply tolerance)
```

The clamp still has to pass §5. Extra `VRWM` is not free margin: `VBR` and `VC` usually rise with it, which is worse for the downstream part.

Example: USB 2.0 D+/D− around 3.3–3.6 V → the 3.6 V class, not 2.5 V, and not a 12 V "safer" generic TVS.

### 4.2 Polarity

Polarity is just "which way does the voltage swing":

| | Breakdown window (sketch) | Use |
| --- | --- | --- |
| Unidirectional | ~0 to +`VRWM` | Mostly positive swing; negative is clamped by the forward junction at about -0.7 V—good when **CMOS cannot take negative** |
| Bidirectional | ~-`VRWM` to +`VRWM` | Analog audio, RS-485, some AC-coupled nets |

A unidirectional part is a normal diode forward (0.7 V) and an avalanche clamp in reverse: the voltage is held once it passes `VBR`, while a negative excursion is caught by the forward junction near -0.7 V. A bidirectional part is two avalanche junctions in series opposition, symmetric, each clamping at its breakdown point above `VRWM`.

Bidirectional is not "safer both ways". Two common mistakes:

- A unidirectional part on a net with a legitimate negative swing → the negative half is crushed and the waveform is clipped.
- A bidirectional part on a pin that hates negative voltages → its negative clamp can sit above that pin's negative abs-max, so it protects nothing.

### 4.3 Channels and package

- 1 ch: keys, antennas, LIN, tight card cages; 0201/0402 (DFN0603/DFN1006)
- 2 ch: USB D+/D−, CANH/CANL, RS-485 A/B—matched capacitance and parasitics per line
- 4 ch: HDMI TMDS, DP lanes, SuperSpeed, Ethernet quads; **flow-through** on fast nets

Channel count serves layout. Do not save a part by sending the ground return on a tour.

### 4.4 IEC 61000-4-2 rating

Contact and air. Device rating **≥ product level**, usually with margin (Level 4 product, 12–30 kV contact parts are common), because fixture ≠ real board.

It does **not** replace clamp voltage, and does **not** replace layout.

### 4.5 Capacitance C

Datasheets quote line capacitance at `VR = 0 V` or at bias. On fast nets read the C–V curve against the **actual bias**: capacitance falls as bias rises, so designing at the worst case (usually 0 V) is the conservative choice.

| Case | C for first-pass selection |
| --- | --- |
| Keys, LEDs, slow GPIO | Several pF to ~10 pF often fine |
| RS-485 (tens of Mbps), audio | Rarely the limiter |
| USB 2.0 480 Mbps | Low C; about 1 pF or less is comfortable |
| Gigabit Ethernet | TI guide: on the order of **< 5 pF** |
| LVDS ~1.3 Gbps | On the order of **< 3 pF** |
| USB 3.x / HDMI 2.1 / DP / PCIe / antenna / FPD-Link | **Ultra-low**, often 0.1–0.3 pF; FPD-Link guide: ≤ 0.3 pF |

### 4.6 Other datasheet lines to match

- **Leakage `IR`**: high-Z analog, battery, reset pins
- **IEC 61000-4-5 surge**: Ethernet, 4–20 mA, outdoor cable. ESD and surge parts differ by an order of magnitude of energy; **a low-C ESD diode is not a surge part**
- **AEC-Q101, operating temperature**: automotive ports
- **TLP I–V / clamp curve**: next section, the core

## 5 Clamping voltage and 16 A TLP

### 5.1 Why the IEC kV is not the protection spec

The gun voltage is the **source** open-circuit voltage. What lands on the IC is the voltage after the protection network—with the diode's dynamic resistance, the PCB inductance, and the IC's own input structure in between.

An IEC 15 kV part rating means only "it did not fail first". If it still clamps at 25 V with 16 A flowing, and the downstream MCU pin abs-max is 4.0 V (assumed), that strike is already out of spec for the pin.

```
VC(I_pulse) < V_IO,absmax      (then leave margin)
```

`V_IO,absmax` comes from the **downstream** datasheet's absolute maximum ratings, not from `VDD`. Some pins tolerate brief voltage above `VDD` (internal diodes); some do not. "It's a 3.3 V rail, so an 8 V clamp is fine" is not an argument.

One clarification: abs-max is a DC rating, not a verdict line for nanosecond pulses. The pass criterion in IEC is *functional degradation*, not "the pin never exceeded abs-max". What you engineer for is letting the TVS carry the bulk of the charge, so the IC only sees voltage and charge its own ESD structure can absorb. "Clamp as low as you can" still holds—just do not read it as an absolute wall.

### 5.2 Why 16 A TLP

IEC 8 kV contact peaks near 30 A, but the front is only about 0.8 ns and collapses quickly—not DC 30 A. TLP (transmission line pulse) injects a pulse of known amplitude and width (typically around 100 ns), measuring V and I point by point, which gives the **dynamic** I–V curve: what the part actually looks like under a nanosecond pulse.

TI uses the **16 A TLP** point as a stand-in for the severity of **8 kV IEC**, so different parts can be compared at one point.

Dynamic clamping is roughly a straight line:

```
VC ≈ VBR + R_DYN · I_ESD
```

`R_DYN` is the slope after breakdown—the dynamic resistance. Same `VBR = 6 V`, `I = 16 A`:

| R_DYN | VC |
| --- | --- |
| 0.5 Ω | 6 + 8 = 14 V |
| 1.5 Ω | 6 + 24 = 30 V |

Identical breakdown voltage, 16 V of difference downstream. So: **read `VC` at a stated current and the whole TLP curve; do not stop at `VBR` / `VRWM`.**

There is also a hard floor: `VC ≥ VBR`. **If `VBR` is already above the downstream abs-max, no amount of `R_DYN` will save it.** Your options are a part with lower `VBR`, a series resistor to divide the voltage, or an interface IC that is itself hardened at system level.

And do not mix 8/20 µs surge, HBM, and TLP numbers in one comparison table—different waveforms, different currents, different answers.

### 5.3 Which plots to open

1. TLP I–V: the voltage at 8 / 16 / 30 A
2. IEC contact residual / voltage waveform, if the vendor provides one
3. C–V, `IR`–`VR`
4. Whether positive and negative clamps are specified separately (they differ a lot on unidirectional parts)

If the pin is 3.3 V GPIO and 16 A still clamps at tens of volts, the diode alone is usually not enough. The usual combination:

- A part with lower `R_DYN` (same `VBR`, steeper slope)
- A very short ground return (§6)
- Series R on slow nets, or an interface IC that is system-level hardened

Fast PHYs usually cannot take series R—clamp and layout have to carry the design, plus whatever ESD tolerance the PHY itself has.

## 6 PCB: the nanosecond current path

### 6.1 Parasitic inductance

```
vL = L · di/dt
```

About 2 nH from the part to the reference plane, 30 A in 0.8 ns:

```
vL ≈ 2e-9 × 30 / (0.8e-9) = 75 V
```

75 V is an order-of-magnitude warning: package inductance, pad-to-via, via-to-plane wander—every one of them adds to `VC`. What the IC sees is closer to:

```
VIC ≈ VC + L_gnd · di/dt + L_stub · di/dt
```

Which means: however low the clamp, an unclean ground return adds those tens of volts straight back. Conversely, if a design "picked a great part and still fails", this path is the first thing to check.

### 6.2 Layout rules (review list)

1. **Park the part on the connector pads**; dump before the run goes to an inner layer.
2. **GND pad: many vias** into a solid plane. Never a skinny trace to the MCU and down there.
3. **Do not send the dump through** MCU / crystal / reset / LDO-feedback ground. Ground bounce shows up as "chassis hit resets the MCU even though the signal pins have diodes".
4. **Fast diffs**: matched, minimum stub, flow-through preferred, part on the connector side of the pair.
5. **Connector shell** is usually the gun's first hit. Whether shell ground is a hard short, a single point, or capacitor-coupled to digital ground is a **product grounding** decision—do not default to either "short it" or "float it". Consumer gear often bonds the shell to board ground as a low-impedance "front door"; isolated industrial ports may keep chassis and signal ground apart and use a spark gap or Y-capacitor, evaluated together with safety requirements.
6. **Power (VBUS, 24 V loops)**: wide copper, enough vias. Surge lasts longer than ESD, so heat and energy are larger.
7. No ferrite bead in the ESD ground pin "for EMI". It blocks the nanosecond current and the voltage appears on the IC instead.

### 6.3 Schematic / grounding

- Every **exposed** net needs a path to the correct reference, including CC, SBU, HPD, reset, and unused pins that still have copper.
- If AGND/DGND are split, the diode must return to the **plane that can actually close the loop**. Crossing a split is extra `L`.
- Draw shields, standoffs, and mounting holes on the grounding diagram—not only diodes on signal nets.

## 7 Per-interface design

There is no universal 5 V TVS. Below are schematic constraints per interface, not a BOM.

### 7.1 Keys / GPIO

Slow; capacitance secondary. `VRWM` covers the GPIO high level; human-touch → full product IEC level. Small single-channel part on the key pad. Uni vs bi depends on whether the IO tolerates negative. A series resistor **after** the ESD part is allowed.

### 7.2 Analog audio

Bipolar swing (line outputs commonly ± several volts) → **bidirectional**. Around 20 kHz, so capacitance is almost free. Pre- and post-amplifier voltages differ by a step; split `VRWM` accordingly, or the amplifier output will drive into the clamp and distort.

### 7.3 CAN / LIN (automotive)

**CAN**: protect CANH and CANL. Do not size from the transceiver's 3.3/5 V rail—ISO 11898 common mode, jump-start, and reverse battery all lift the bus far above `VCC`. On 12 V systems, **24 V working voltage** is a common starting point, with some requirements at 36 V. Dual channel keeps the two lines' capacitance matched. CAN-FD / CAN-XL run faster, so pick the lowest `C` you can at 24 V.

![Figure 3-3 CAN application circuit: a bidirectional part guards CANH/CANL and dumps to ground nearby](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-3-3-can.png)

Several details are visible in Figure 3-3: the protector is one dual bidirectional device, one channel on CANH and one on CANL, common terminal straight to GND. It sits between the connector and the split termination (`RT/2` + `RT/2`)—the first stop on the bus. `CG` is the common-mode capacitor. The red arrows are the ESD current: in from the bus, to ground at the part, leaving only residual for the transceiver.

**LIN**: one wire, sized the same way—assume about 2× battery voltage from miswiring; the 24 V class, single channel, on 12 V systems.

### 7.4 RS-485

Receiver common mode about **-7 V to +12 V** → bidirectional, `VRWM` ≥ 12 V, two channels on A/B. Up to roughly 50 Mbps, so capacitance is rarely the first constraint. Outdoor long runs need surge and isolation evaluated separately.

### 7.5 USB 2.0 / 3.x / Type-C

| Net | Voltage | Capacitance | Notes |
| --- | --- | --- | --- |
| D+/D− | ~3.6 V class | Low-C for USB2; still far looser than SuperSpeed | 2-ch is natural |
| SuperSpeed TX/RX | ~3.6 V class | USB 3.1 Gen2 guide: about **≤ 0.3 pF** | 4-ch flow-through common |
| VBUS | ≥ 5 V; PD up to 20 V | Not a data net | High-voltage flat-clamp class, not a high-speed ESD diode |
| CC / SBU | up to ~5.5 V | Low C still wise in Alternate Mode | 1-ch toward the PD controller |

The three USB generations differ visibly on the schematic:

![Figure 3-15 USB 2.0 application circuit: one part each on VBUS, D-, D+](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-3-15-usb2.png)

Figure 3-15 is the plain form: three single-channel bidirectional parts on VBUS, D−, and D+, commons joined and taken to ground. The VBUS part is chosen for the supply voltage; the D+/D− parts for the 3.6 V class plus low capacitance. **Three nets, three constraints—do not merge them into one part.**

![Figure 3-16 USB 3.1 application circuit: the three USB2 parts plus a 4-channel flow-through for SuperSpeed](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-3-16-usb3.png)

Figure 3-16 stacks two sets on one board: the USB2 trio on top, and below it the TX/RX pairs running into a 4-channel flow-through device—in on the left, out on the right, ground vias in the middle. The super-speed pairs never stub off; the cost is that the part has to sit *on* the trace.

![Figure 3-17 USB Type-C application circuit: high-speed, CC/SBU, and VBUS handled separately](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-3-17-usbc.png)

Figure 3-17 is the full Type-C picture and the clearest case of "one part cannot cover it": one 4-channel flow-through per RX/TX pair, the 5.5 V class on CC1/SBU2 and SBU1/CC2, separate parts on D+/D−, and a high-voltage part on each VBUS. Twenty-four pins in almost no area—**the high-speed nets and VBUS are an order of magnitude apart in clamping class and must not share a part.**

In one line: ultra-low-C multi-channel for the fast pairs, 5.5 V class for CC/SBU, a separate high-voltage clamp for VBUS.

### 7.6 HDMI / DisplayPort / PCIe / LVDS / FPD-Link

Shared idea: ultra-low C and multi-channel flow-through on the fast lanes; the slower control lines (DDC, HPD, AUX, CEC) carry higher voltage and **must not reuse the TMDS/ML capacitance spec**.

- DP: around 20 Gbps per lane; eight fast lines and the slow AUX/HPD are separate budgets.
- HDMI 2.1: tiny C on TMDS/FRL; 5.5 V class on the 5 V control lines.
- PCIe 4.0–6.0: capacitance tightens with each generation; 12 V / 3.3 V power pins are different parts.
- LVDS: about < 3 pF per the guide; protect both ends of the cable.
- FPD-Link: `VRWM` matching 3.3/5 V, C ≤ 0.3 pF, **both ends**.

### 7.7 Ethernet

Four TX/RX lines; a 4-channel part is convenient. Around 1–2.5 V, and gigabit makes C matter (about < 5 pF). An RJ45 that leaves the enclosure or runs long cable also needs **IEC 61000-4-5**: the common stack is an energy device at the jack (gas discharge tube / large TVS) plus low-C ESD at the PHY, with the magnetics' discharge path drawn explicitly. One ESD diode on the PHY pins is not an outdoor port.

### 7.8 Antenna

A low-impedance entry, up to tens of GHz → **tiny C** (0.1 pF class), small package at the feed point or connector. `VRWM` must follow that RF port's bias—do not assume 3.6 V, because some biases are not low.

### 7.9 SD / SIM

Area is tight, so small packages first. Modest speed, so C is secondary. DAT/CMD/CLK/VDD at the slot opening are all entry points.

### 7.10 4–20 mA and industrial loops

Long cable means ESD **and** surge. Loop supplies are often 24 V, so `VRWM` a step above (the 33–36 V surge class is common). Transmitter, source, and receiver all count.

![Figure 3-18 4-20 mA application circuit: protection at both ends of the loop](https://assets.virongx.com/blog/posts/2026/ESD-system-level-protection/fig-3-18-4-20ma.png)

The point of Figure 3-18 is "both ends": one part on each leg of the loop at the transmitter side on the left, and the same again at the receiver/source side on the right, with red arrows marking both discharge paths. A long cable can be hit at either end, so protecting one end protects half the loop. Note also that these parts are sized for the 24 V loop, not a 3.6 V logic class.

**A low-C ESD diode is not a surge design.**

## 8 Workflow from schematic to a passing test

Doing it in this order beats "pick a 15 kV part first".

**1. List every net that leaves the enclosure**: every connector pin—signal, power, shield, unused. Unused copper is still an entry point.

**2. Fill a row per net**:

| Field | Drives |
| --- | --- |
| Normal voltage (CM, PD, audio swing) | `VRWM`, polarity |
| Rate / edge | C, flow-through |
| Downstream part and pin abs-max | Clamp target |
| Product IEC, surge, automotive | Device IEC/surge, Q101 |
| Which ground | Where the diode returns, how the shell returns |

**3. Select**: `VRWM` and polarity → capacitance ceiling → IEC/surge → open the TLP curve and read `VC` at the current of interest → channels/package from the connector's pin order.

**4. Layout**: work §6.2; for fast ports run SI or at least check stub length.

**5. Align with mechanics and grounding**: gun on the shell, seam, key, connector body: does the return current cross the MCU ground?

**6. Test**: IEC 61000-4-2, covering contact/air, both polarities, the specified points and repetitions. Record the failure type—soft fail (reset) or hard fail (dead pin). Soft: ground bounce, reset/crystal coupling. Hard: clamp on that pin, ground vias, a missed net.

### 8.1 Walk-through: a USB 2.0 port on a 3.3 V MCU

Applying the flow to one interface makes the decision chain concrete.

Assume a 3.3 V MCU whose D+/D− absolute maximum is **-0.3 V to 4.0 V**; the port is USB 2.0 high speed at 480 Mbps; the product must pass IEC Level 4 (8 kV contact / 15 kV air).

1. **Voltage window**: D+/D− high level 3.3 V plus overshoot → `VRWM = 3.6 V` class.
2. **Capacitance**: 480 Mbps is "low, but not ultra-low"—about 1 pF or less is comfortable; package: small single/dual.
3. **Polarity**: the USB pair never sits at a negative DC level, but high-speed edges do overshoot slightly negative. A unidirectional part clamps that at about -0.7 V through its forward junction; a bidirectional part is symmetric. Which one you use depends on the PHY's negative tolerance—the floor requirement is that legitimate overshoot is not clipped.
4. **Device rating**: at least 8 kV contact / 15 kV air; 12–15 kV contact is the usual engineering margin.
5. **Clamp**: open the TLP curve and read `VC` at 16 A. Suppose it reads 9 V—already above the 4.0 V abs-max.
6. **Then what**: USB2 high speed cannot take a series resistor, so

   - pick a part with lower `R_DYN` and push the 16 A `VC` down;
   - keep the ground return within a few nH to avoid the tens of volts from §6;
   - accept that the TVS takes the bulk of the charge and the PHY's own ESD structure absorbs the rest—then confirm by measurement that function does not degrade.

7. **Verify**: contact/air, both polarities, the specified number of hits. Watch for reset, dropped link, and leakage growth afterwards.

The value of the example is the **decision chain**, not the specific numbers: voltage window → capacitance → polarity → rating → clamp → fallbacks. When one step fails you know immediately what to change.

**Four checks before schematic release:**

1. Idle conduction? `VRWM`, leakage, polarity.
2. Does the part live? IEC (and surge).
3. How high does the IC see? Stated-condition clamp vs abs-max.
4. Enter/leave path? Connector, diode, plane, shell.

## 9 Failures and debug

| Symptom | Look first |
| --- | --- |
| Hit on a signal pin: link errors, or dead silicon after the hit | `VC` too high, wrong `VRWM`/polarity, diode too far from the connector |
| Hit on chassis/screw: MCU resets, signal pins look fine | Return through chip ground, supply bounce, unprotected or coupled reset |
| USB3/HDMI eye fails SI but ESD passes | C too high, stub, package not flow-through |
| Plug in and the link is already wrong / hot / wrong levels | `VRWM` below the signal, a unidirectional part eating the negative half-cycle |
| Ethernet / 4–20 mA passes ESD, dies on surge | ESD only, no surge |
| 30 kV part, product dies at 8 kV | Layout inductance, a missed pin, shell grounding, downstream abs-max |

Measuring residual ESD voltage needs real bandwidth (nanosecond front). A 100 MHz probe will filter the spike away and then "prove" the clamp is 5 V—a classic measurement artefact. Trust the TLP/datasheet and failure analysis; board waveforms are supporting evidence.

## 10 Summary

HBM/CDM cover the component's life; IEC covers the product's interface. The discrete diode stays off in traffic and dumps current on a hit; the IC only sees what is left after clamp plus layout inductance.

Selection order is fixed: **voltage window → capacitance → device survival rating → dynamic clamp → package/channels**, then draw the nanosecond loop into the PCB and the grounding scheme. Constraints shift by interface: CAN starts with common mode and miswiring, USB3 with capacitance, industrial loops with surge.

> What you are protecting is the system's current path and the downstream voltage budget—not the kV printed on the TVS.

## Appendix: glossary

| Term | Meaning |
| --- | --- |
| ESD | Electrostatic discharge |
| TVS | Transient voltage suppressor, the ESD diode usually found at an interface |
| HBM | Human body model, a device-level test |
| CDM | Charged device model, a device-level test |
| IEC 61000-4-2 | Product-level ESD immunity standard: contact and air discharge |
| TLP | Transmission line pulse, used to measure dynamic I–V |
| `VRWM` | Reverse working voltage, the highest voltage at which the part stays off |
| `VBR` | Breakdown voltage |
| `VC` | Clamping voltage at a stated pulse current |
| `R_DYN` | Dynamic resistance, the slope of the post-breakdown I–V curve |
| abs-max | Absolute maximum rating, the part's hard limit |
| flow-through | Package where the signal enters one side and exits the other |
| soft / hard fail | Function interrupted and recoverable / part permanently damaged |

## References

- Texas Instruments, *System-Level ESD Protection Guide*, SSZB130E, August 2025.
- [ESD protection is not "drop a TVS and done"](https://mp.weixin.qq.com/s/pJFYR1YsTd-GmgD5l3lBDA)

For a real board, freeze the numbers from the current diode and IC datasheets and from the IEC/ISO/safety standard that applies to the product.

**Last updated: November 26, 2026 00:15:35**
