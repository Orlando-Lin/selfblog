---
title: Motor FOC Fundamentals
description: From torque and coordinate transforms to the current loop and SVPWM, one thread through FOC's physical picture, its derivations, and the MCU implementation.
date: 2026-11-24
category: Tech
tags: [Motor, Learning, FOC, PMSM, Embedded]
cover: https://assets.virongx.com/blog/covers/电机FOC理论基础.png
---

> Who this is for: learners who want to understand FOC from first principles and be able to map the formulas onto the sampling, computation, and PWM inside an MCU. The thread here is the three-phase permanent-magnet synchronous motor (PMSM) with a symmetric and nearly sinusoidal field: surface-mounted machines first, then interior-mounted ones. Every numerical example is a teaching assumption, not a real motor's parameters.

## Introduction: See the Whole Picture, Then Learn It in Order

### 1. What FOC Actually Is

**FOC (field-oriented control), also called vector control, picks a rotating coordinate frame aligned with the target field direction, splits the current into components that can be regulated separately, and then uses an inverter to control the actual current.** For the PMSM in this note, the d-axis can first be read as "the reference axis that turns with the rotor magnets", with the q-axis perpendicular to it. Precise terms such as "permanent-magnet flux linkage" are explained with the figures in Section 5 of this introduction.

Start with one idea: **what turns a motor is torque, the controller usually regulates electromagnetic torque by regulating current, and current in turn is changed by applying voltage.** So between "command a torque" and "emit a PWM pattern" there is a complete physical chain.

FOC can improve torque control and smoothness of operation, but how much depends on the motor, the current sensing, the angle, the control parameters, and the power stage. It also serves zero-speed holding, braking, and generating; it is not only about making the motor spin.

### 2. One Complete Control Cycle

Read the actual operating sequence once, as a chain of cause and effect:

1. **Set the target.** Torque mode takes a torque or current target directly; speed mode first has a speed controller produce a torque-current target; position mode usually adds a position outer loop on top.
2. **Derive the current targets.** A basic surface-mounted PMSM usually takes $i_d^*=0$ and specifies the direction and magnitude of torque through $i_q^*$. The asterisk marks a commanded value.
3. **Measure the actual state.** The ADC samples current, the position sensor provides the rotor angle, and the DC bus voltage is measured as well.
4. **Clarke transform.** The three phase currents $i_a,i_b,i_c$ become $i_\alpha,i_\beta$ in a stationary orthogonal frame.
5. **Park transform.** The rotor electrical angle converts $i_\alpha,i_\beta$ into $i_d,i_q$.
6. **Current PI.** Compare the commanded and actual currents and compute the required d-axis and q-axis voltages; feedforward compensation can be added here.
7. **Voltage limiting and inverse Park.** Turn the achievable $u_d,u_q$ back into $u_\alpha,u_\beta$.
8. **SVPWM.** Together with the bus voltage, the voltage command becomes PWM duty cycles for the three half-bridges.
9. **The inverter acts.** The power devices switch and deliver energy from the DC bus into the motor, or return mechanical energy to the bus.
10. **The motor responds, and the loop closes again.** Voltage changes current, current produces torque, torque affects the mechanical motion, and the next sample corrects what is left.

**The position and speed loops are used as needed; the current loop is the core of this note.** The steps above form a closed loop that repeats, not a sequence that runs once. Real digital control also carries time delay between sampling, computation, and the PWM update.

### 3. Why the Chapters Come in This Order

**First understand why the motor turns, then how to describe it, then how to control it, and finally how to implement the control.**

- [Chapter 1](#chapter-1-why-the-motor-turns): the motor and the rotating field. Start with why current is related to torque.
- [Chapter 2](#chapter-2-sine-waves-angles-and-space-vectors): angles, sine waves, and vectors. The vocabulary the transforms need.
- [Chapter 3](#chapter-3-clarke--putting-the-three-phases-into-an-orthogonal-plane): Clarke. Putting the three phase quantities into an orthogonal plane.
- [Chapter 4](#chapter-4-park--observing-the-current-with-the-rotor): Park. Observing with the rotor, turning synchronous quantities into components that are convenient to regulate.
- [Chapter 5](#chapter-5-voltage-current-and-torque-in-the-pmsm): the PMSM model. Pinning down the relations between current, voltage, flux linkage, speed, and torque.
- [Chapter 6](#chapter-6-the-current-loop-and-pi): the current PI. How voltage makes current track a target.
- [Chapter 7](#chapter-7-the-inverter-average-voltage-and-svpwm): the inverter and SVPWM. How a mathematical command becomes a real voltage.
- [Chapter 8](#chapter-8-running-the-whole-foc-loop-on-an-mcu): MCU implementation. Sampling, angle, timing, and a full worked example, joined end to end.
- [Chapter 9](#chapter-9-speed-loop-position-loop-and-operating-limits): speed, position, and operating limits. The outer loops and the boundaries around them.
- [Chapter 10](#chapter-10-common-symptoms-and-advanced-control): symptom analysis and advanced control. Connecting what you observe back to the theory.
- [Reference](#reference-look-things-up-by-topic): mathematics, circuits, magnetics, hardware, and symbol conventions, by topic.

On a first pass, follow the main line. Where a matrix or an integral looks unfamiliar, understand the expanded formula and its physical meaning first, and consult the reference section later. Each chapter introduces only what the current explanation needs.

### 4. Conventions Used Throughout

Throughout, the **amplitude-invariant Clarke transform** is used: the $\alpha$-axis coincides with the positive axis of the A-phase fundamental MMF, and the $\beta$-axis leads the $\alpha$-axis by 90° counter-clockwise. The fundamental MMF axes of phases A, B, and C sit at 0°, 120°, and 240°. The d-axis points along the positive direction of the rotor permanent-magnet flux linkage, and the q-axis leads the d-axis by 90° in the positive electrical-angle direction. Current flowing from the inverter into the motor is positive.

This note writes $u$ for voltage, $i$ for current, $p$ for the number of pole pairs, and $T_e$ for electromagnetic torque. Trigonometric arguments in the formulas are in radians; figures and examples also use degrees for readability. Phase-current peak values and RMS values are never mixed. Unless stated otherwise, resistance means resistance per phase, and inductance means the d-axis and q-axis inductance consistent with the model at hand.

Other references may swap the phase order, reverse the q-axis, or use a power-invariant transform. The formulas change with the convention, so partial formulas lifted from different sources cannot simply be stitched together.

> The rules shared by the whole note are listed up front so they can be looked up later. The names inside them — "positive axis of the phase fundamental MMF", "permanent-magnet flux linkage", "amplitude-invariant" — are explained one by one immediately below; on a first read you can skim the rules here and then come back to them with the figures.

### 5. Terms and Figures

Nothing here needs to be memorized; the point is to recognize the objects in the figures. **"Positive axis of the phase fundamental MMF" and "direction of the permanent-magnet flux linkage" exist only to say precisely what our arrows stand for and where angles are measured from.** The formulas are derived later.

#### 5.1 What a "phase" is, and why one phase has one direction

A phase is one set of windings inside the motor that are connected together and carry the corresponding current as a group. Three-phase means three such sets, A, B, and C. Each set may contain several coils distributed across different slots; it should not be pictured as three small coils inside the motor.

When the current defined as positive flows in phase A, it establishes a magnetic field with a definite spatial distribution. For analysis we first extract the dominant, smooth part of that distribution and describe it with a single directed axis. That is the "phase fundamental MMF axis" unpacked just below.

#### 5.2 MMF: the "driving capability" that establishes flux

Why does an energized winding produce a magnetic field? Start from MMF: **magnetomotive force, or MMF, is the driving action by which a current or a permanent magnet establishes flux along a magnetic circuit.** It is not a mechanical force and is not measured in newtons.

For a simple coil of N turns carrying current i, the MMF is:

$$
\mathcal F=Ni
$$

In practice the unit is often quoted as ampere-turns. For example, 100 turns carrying 1 A and 50 turns carrying 2 A both give 100 ampere-turns of MMF in the simple model. How much flux that produces still depends on the material, dimensions, air gap, and saturation state of the magnetic circuit.

A limited analogy helps: voltage drives current, MMF drives flux. In a linearized magnetic circuit $\Phi=\mathcal F/\mathcal R$, where $\mathcal R$ is the reluctance. But flux is not a flowing substance; the analogy only conveys "driving action versus obstructive condition".

**MMF, magnetic field, flux, and flux linkage are related, but they are not the same quantity.** For a distributed winding, $Ni$ identifies the basic source; the amplitude of the fundamental spatial MMF also involves coil distribution, winding factor, and pole arrangement, so the total turns of a phase multiplied by current is not the MMF at an arbitrary position.

#### 5.3 The fundamental: the most basic layer of a complex spatial distribution

Real coils sit in slots, so the spatial MMF they produce may ripple and is not perfectly sinusoidal. A complex distribution can be decomposed into a sum of smooth waveforms.

**The fundamental is the layer with the most basic spatial period; harmonics are the ripples that repeat more times within that period.** What is meant at this point is variation in space around the circumference, described in electrical angle, not variation of current in time.

As an illustration, one can write:

$$
F(\chi)=\cos\chi+0.2\cos3\chi
$$

Here $\chi$ is the spatial electrical angle around the circumference, $\cos\chi$ is the fundamental, and $0.2\cos3\chi$ is the third spatial harmonic. Their sum gives a slightly distorted distribution. The expression exists only to explain the decomposition; it is not a waveform measured on any motor.

![Decomposition of the fundamental and spatial harmonics](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/术语图01_空间基波.png)

*Reading the figure: the horizontal axis is position around the circumference at one instant, not time. The left panel keeps the two layers apart and the right panel adds them; extracting the fundamental means first taking hold of that most basic smooth variation. The illustration uses normalized values.*

Split into four pieces, "positive axis of the phase fundamental MMF" becomes easy:

- **Phase**: consider only the contribution of the A-phase winding set.
- **Fundamental**: take only its main sinusoidal component in space.
- **MMF**: the driving action by which the winding current establishes flux.
- **Positive axis**: which spatial direction the positive peak of that component points to when the A-phase current is defined as positive.

So **"the α-axis coincides with the positive axis of the A-phase fundamental MMF" can first be read as "take this equivalent positive direction of phase A as horizontal-right in the fixed frame".** The axis is fixed to the stator; it is not the orientation of a particular copper wire, and when the current goes negative the action simply reverses without the axis needing a new name.

#### 5.4 Flux and flux linkage: one turn first, then all turns together

**Flux $\Phi$** describes the total effect of the magnetic field crossing a surface. Where the field is uniform and perpendicular to an area S, $\Phi=BS$, with B the flux density. If the field is inclined, the perpendicular component is taken; in general $\Phi=\int_S\boldsymbol B\cdot d\boldsymbol S$. The unit of flux is the weber.

**Flux linkage $\psi$** then sums the flux linked by each turn of the winding, with signs following the winding direction:

$$
\psi=\sum_{k=1}^{N}\Phi_k
$$

If all N turns link the same flux, $\psi=N\Phi$. For instance, 0.001 Wb per turn over 10 turns gives 0.01 Wb of flux linkage. Engineering writing sometimes uses Wb·turn to emphasize the turns; turn count is a pure count dimensionally, so the usual unit remains the weber.

![Relationship between flux and flux linkage](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/术语图02_磁通与磁链.png)

*Reading the figure: the left side shows the flux linked by a single turn and the right side adds the per-turn contributions. The coil outline is schematic; the field lines are drawn to help observation and their number does not represent the actual amount of flux. The many-turn result assumes the per-turn flux stays the same, a premise that has to be judged separately in a real system.*

Flux linkage is useful because **the faster the flux linked by a winding changes, the larger the induced voltage usually is**. With the chosen voltage and current reference directions, the terminal voltage equation of the motor contains $d\psi/dt$; if the reference direction of the induced EMF itself is what is being discussed, Faraday's law is often written $e=-d\psi/dt$. The minus sign expresses Lenz's law, and signs cannot be compared apart from the direction definitions.

#### 5.5 Permanent-magnet flux linkage: naming the source too

"Permanent magnet" refers to the permanent magnets on the rotor. **Permanent-magnet flux linkage is the contribution to flux linkage produced by those magnets and linked by the stator winding under study.** It is not some physical chain called "flux linkage", and it does not require the stator to be energized first.

As the rotor turns, a given phase winding changes its position relative to the rotor field, so the permanent-magnet flux linkage of that phase varies with position. In the ideal sinusoidal model:

$$
\psi_{a,f}=\psi_f\cos\theta_e
$$

Here $\psi_{a,f}$ is the permanent-magnet flux linkage of phase A at the present angle, and $\psi_f$ is its amplitude in the amplitude-invariant model used here. The other two phases carry the corresponding 120° shift.

Once the three phase quantities are brought into spatial coordinates, this flux linkage can be drawn as one arrow that turns with the rotor. **The d-axis lies along the positive direction of that arrow; the q-axis is perpendicular to it and, by the convention here, leads it by 90° counter-clockwise.** In the frame that turns with the rotor the ideal permanent-magnet flux linkage has a d-axis component of $\psi_f$ and a q-axis component of 0; observed from the fixed phase-A winding it still varies with angle. The two statements do not conflict.

![Fixed frame and rotor frame](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/术语图03_先认识坐标轴.png)

*Reading the figure: the blue α/β axes are fixed to the stator; the green d/q axes turn with the rotor; the orange arrow is the direction of the permanent-magnet flux linkage and coincides with the positive d-axis. The figure shows a single instant, and lengths carry no quantitative meaning. θe is measured from the positive α-axis to the positive d-axis. A multi-pole motor lives in an electrical-angle equivalent space, so the figure should not be taken as an actual mechanical cross-section.*

The expression $\psi_d=L_di_d+\psi_f$ that appears later means the total flux linkage along d, made up of the stator current contribution and the permanent-magnet contribution. **Total flux linkage and permanent-magnet flux linkage are not always the same thing**, especially under field weakening with negative d-axis current.

#### 5.6 The conventions again, in plain words

With the figures above in mind, the conventions of this note reduce to a few things:

1. **How the fixed axes are drawn.** The equivalent positive direction of phase A is drawn horizontally to the right and called the α-axis; the upward direction 90° counter-clockwise from it is the β-axis. Neither axis turns with the rotor.
2. **How the rotating axes are drawn.** The d-axis follows the positive direction of the rotor permanent-magnet flux linkage; the q-axis is 90° counter-clockwise from it. Together they turn with the rotor.
3. **Where angles are measured from.** The rotor electrical angle θe runs counter-clockwise from the positive α-axis to the positive d-axis. How it differs from the mechanical angle is covered in Chapter 2.
4. **The order of the three phases.** The equivalent positive axes of A, B, and C sit at 0°, 120°, and 240° electrical. These are equivalent spatial directions; they do not mean every real coil sits at only those three positions.
5. **The sign of current.** Current flowing from the inverter into a motor phase terminal is positive, and the reverse is negative. Only with a single sign rule do the formulas correspond to each other.

"Amplitude-invariant Clarke" can be read for now as: **a scale is chosen so that the phase-current peak of an ideal balanced sinusoidal current equals the length of the transformed current vector.** At 10 A peak per phase the vector is also 10 A long; why the factor 2/3 appears is derived in Chapter 3. It does not mean the three instantaneous phase currents never change.

This note writes u for voltage, i for current, p for the number of pole pairs, and Te for electromagnetic torque. Trigonometry in code is usually computed in radians; degrees are used for intuitive labeling. The difference between peak and RMS current is covered in Chapter 2. Resistance in the models means resistance per phase by default, and inductance follows the d-axis and q-axis definitions the model uses.

Other references may adopt a different phase order, q-axis direction, or transform scale. While working through this note, keep to the rules here; when comparing with another source, check the directions in its figures and its formulas together.

## Chapter 1: Why the Motor Turns

This chapter explains "current → field → torque", which is the physical basis for why FOC controls current.

### 1.1 Stator, rotor, and windings

The stator is the part that normally stays still, and it carries the windings; the rotor is the moving part. A PMSM rotor carries permanent magnets that establish the rotor field. The three phase windings are usually called A/B/C or U/V/W, each brought out to one phase terminal.

**A phase is not a single coil.** One phase may be built from several coils distributed over several slots and connected together. A teaching figure that draws one arrow for a phase axis is an equivalent representation of that phase's fundamental MMF, not the position of all its conductors.

In a surface-mounted PMSM (SPMSM) the magnets sit on the rotor surface, and $L_d\approx L_q$ is a common approximation. In an interior-mounted PMSM (IPMSM) the magnets are buried inside the rotor, usually giving more pronounced saliency — read it for now as flux being easier to establish in some rotor directions than in others, which shows up as different d-axis and q-axis inductance, $L_d\ne L_q$.

### 1.2 How current produces field and torque

An energized winding produces MMF, the driving action that establishes flux; flux is the total effect of the field crossing a chosen cross-section. The magnetic circuit is the path the flux follows, and it may include iron and air gaps. Reversing the current reverses the MMF direction, and in the linear approximation more current means more MMF.

The field produced by stator current interacts with the rotor field and produces electromagnetic torque. Intuitively, the controller keeps arranging the direction of the stator MMF so that the rotor feels a turning action in the wanted direction.

But "the rotor chases the stator field" is only an entry-level picture. In steady synchronous operation the two can hold a fixed relative angle and rotate at the same electrical angular velocity; once electromagnetic torque balances the load, the rotor stops accelerating.

For a PMSM with negligible saliency, at a given current-vector magnitude, placing the current on the q-axis gives the largest permanent-magnet torque. **This is about the relative direction of the current vector and the rotor flux linkage, not a claim that the voltage vector must always be 90° away from the rotor flux.** Voltage also has to cover the resistive drop, the inductive dynamics, and the back EMF.

### 1.3 Why one phase usually produces only a pulsating field

A sinusoidal current in a winding with a fixed axis makes its MMF swing along that axis: strong, weak, through zero, then reversed. On its own it cannot give the constant-amplitude, single-direction rotating MMF wanted here.

A three-phase system places three fundamental MMF axes 120° electrical apart and drives them with three-phase currents in the proper phase sequence. Their combined fundamental MMF then rotates continuously.

Dividing 360° by three gives the even spacing of a symmetric three-phase set; a constant-amplitude rotating MMF also requires the current magnitudes, the time phases, and the spatial distribution to fit together. 120° is not the only choice that produces a rotating field — two orthogonal windings in quadrature do it as well.

### 1.4 Three instants of the rotating field

Let the three phase currents be:

$$
i_a=I_m\cos\phi,\quad
i_b=I_m\cos(\phi-2\pi/3),\quad
i_c=I_m\cos(\phi+2\pi/3)
$$

Adding the phase MMFs along their axes, under linear, symmetric conditions and with only the fundamental retained, gives a resultant proportional to the vector below:

$$
\frac32 I_m\left(\cos\phi\,\boldsymbol e_\alpha+\sin\phi\,\boldsymbol e_\beta\right)
$$

With $I_m=10\,\mathrm A$:

- $\phi=0°$: the phase currents are $10,-5,-5$ A and the resultant points at 0°.
- $\phi=60°$: the phase currents are $5,5,-10$ A and the resultant points at 60°.
- $\phi=90°$: the phase currents are $0,8.660,-8.660$ A and the resultant points at 90°.

Each phase current keeps changing, yet the combined fundamental MMF holds its amplitude and rotates continuously. The $3/2$ here is the unnormalized geometric combination factor, which the $2/3$ of the Clarke transform later normalizes.

### 1.5 How brushed DC, BLDC, and PMSM relate

A brushed DC motor commutates mechanically with brushes and a commutator; a three-phase permanent-magnet motor has its phase currents arranged by an electronic power stage.

BLDC is usually discussed together with trapezoidal back EMF and six-step commutation, PMSM together with nearly sinusoidal back EMF and sinusoidal current. Product naming is not always strict. A motor labeled BLDC may still be driven with FOC, though non-sinusoidal waveforms reduce the accuracy of the simplified model and add torque ripple.

![Animation of six-step commutation](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/FOC_6_step_modulation.gif)

*Figure 1: six-step commutation as illustrated in the SimpleFOC documentation. It helps show how electronic commutation changes the field direction; six-step commutation switches discretely, so this figure is not a complete demonstration of FOC's continuous current-vector control. [Source S1](#references-and-image-sources).*

This chapter has connected current to torque. The next one first learns to describe current variation and rotor direction precisely.

## Chapter 2: Sine Waves, Angles, and Space Vectors

### 2.1 Every symbol in a sine wave

$$
i(t)=I_m\sin(\omega t+\phi_0)
$$

$i(t)$ is the instantaneous current at some moment, $I_m$ the peak, $t$ the time in s, $\omega$ the angular frequency in rad/s, and $\phi_0$ the initial phase. $\omega t+\phi_0$ says how far the waveform has advanced within a period; **it does not say where the charge in the current sits around the circumference of the motor.**

$$
T=\frac1f,\qquad \omega=2\pi f,\qquad 2\pi\ \mathrm{rad}=360°
$$

For example at $f=50\,\mathrm{Hz}$, $T=20\,\mathrm{ms}$ and $\omega\approx314.16\,\mathrm{rad/s}$. Then $t=0.005\,\mathrm s$ is 5 ms later, which advances the phase by 90°.

A pure sinusoidal current has RMS value $I_{\mathrm{rms}}=I_m/\sqrt2$. A peak of 10 A corresponds to about 7.071 A RMS. Motor heating is usually discussed in RMS terms, while the amplitude-invariant d/q currents inside the controller correspond to the phase-current peak scale under balanced sinusoidal steady state.

### 2.2 A three-phase phase difference is not "one phase at a time"

For $i_a=I_m\sin\omega t$, $i_b=I_m\sin(\omega t-120°)$, and $i_c=I_m\sin(\omega t-240°)$, all three exist at the same time; only the phase differs.

At constant frequency, a phase difference converts into a time difference between corresponding features:

$$
\Delta t=\frac{\Delta\phi}{2\pi}T
$$

At 50 Hz, 120° is $20/3\approx6.67$ ms. That means zero crossings in the same direction, or peaks, are offset by that time; it does not mean phase B waits for phase A to finish conducting.

When frequency varies with time, write $\phi(t)=\phi_0+\int_0^t\omega(\tau)\,d\tau$; a fixed 6.67 ms taken at one frequency cannot stand for a 120° difference in general.

![Three-phase current waveforms](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/公式图01_三相电流波形.png)

*Reading the figure: the three curves coexist on one time axis; what is offset horizontally are features such as the peaks. The plot uses cosine, which differs from the sine form in the text only by a common initial phase and does not change the 120° relation between the phases. All figures here are original teaching plots computed from the formulas in the text, not measured data.*

### 2.3 Mechanical angle and electrical angle

The mechanical angle $\theta_m$ describes how far the shaft has actually turned. The electrical angle $\theta_e$ describes position within a pole-pitch cycle. With $p$ pole pairs on the rotor, one shaft revolution passes through $p$ electrical cycles:

$$
\theta_e=p\theta_m+\theta_0\pmod{2\pi},\qquad
\omega_e=p\omega_m
$$

$\theta_0$ is the offset that follows from the chosen sensor zero, phase axis, and rotor flux direction; production code may equally well subtract an offset, and the meaning depends on how the offset is defined.

With mechanical speed $n$ in rpm:

$$
\omega_m=\frac{2\pi n}{60},\qquad f_e=\frac{pn}{60}
$$

For a 7-pole-pair motor at 600 rpm, the mechanical frequency is 10 Hz and the electrical frequency 70 Hz; the mechanical angular velocity is about 62.83 rad/s and the electrical one about 439.82 rad/s. Ten mechanical degrees is 70 electrical degrees.

**Three phase axes 120° electrical apart is not the same as any three sets of coils being 120° mechanical apart.** A multi-pole motor also involves slot count, coil pitch, and winding distribution.

### 2.4 Time phase, spatial direction, and vectors

A phase current $i_a$ is a signed scalar; the MMF of that winding has a fixed spatial axis. Adding the three contributions lets a single space vector express the combined fundamental effect.

A planar vector can be written as:

$$
\boldsymbol i=i_\alpha\boldsymbol e_\alpha+i_\beta\boldsymbol e_\beta,\qquad
|\boldsymbol i|=\sqrt{i_\alpha^2+i_\beta^2}
$$

Its direction comes from $\operatorname{atan2}(i_\beta,i_\alpha)$. That suits code better than $\arctan(i_\beta/i_\alpha)$ used directly, because it distinguishes quadrants and handles a zero abscissa.

A time phasor is commonly used to represent the amplitude and phase of sinusoids at one frequency; a space vector describes the combined spatial effect of three phase quantities at one instant. The two are mathematically related but not the same idea.

## Chapter 3: Clarke — Putting the Three Phases into an Orthogonal Plane

This chapter covers the first mathematical step after current sampling. **What the transform changes is the representation, not the real three-phase winding, which does not become two windings.**

![Mechanical angle and electrical angle](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/公式图04_机械角与电角度.png)

*Reading the figure: the left panel shows the unwrapped, accumulated electrical angle; for trigonometry it can be taken modulo 360°. The right panel shows the pole-pitch cycle repeating seven times per mechanical revolution. All figures here are original teaching plots computed from the formulas in the text, not measured data.*

### 3.1 Why only two currents are independent

For a three-wire motor terminal with no neutral connection, ignoring parasitic currents to ground, Kirchhoff's current law gives:

$$
i_a+i_b+i_c=0
$$

Knowing two phases gives the third, $i_c=-i_a-i_b$. The constraint comes from the connection; it does not require the three currents to be balanced or sinusoidal.

If a neutral current path exists, the zero-sequence component has to be considered. Real high-frequency switching circuits also carry common-mode parasitic currents, sampling that is not simultaneous, and measurement error, so the measured three-phase sum may not be exactly zero.

### 3.2 Deriving the formulas from geometric projection

The A, B, and C phase axes lie at 0°, 120°, and 240°. Without normalizing yet, project each contribution onto the horizontal and vertical directions:

$$
x=i_a+i_b\cos120°+i_c\cos240°
=i_a-\frac12i_b-\frac12i_c
$$

$$
y=i_b\sin120°+i_c\sin240°
=\frac{\sqrt3}{2}(i_b-i_c)
$$

The three-phase fundamental combination produces an amplitude factor of $3/2$. Multiplying by $2/3$ makes the peak of a balanced sinusoidal phase current equal to the space-vector magnitude, which gives the amplitude-invariant Clarke transform used here:

$$
\boxed{i_\alpha=\frac23\left(i_a-\frac12i_b-\frac12i_c\right)}
$$

$$
\boxed{i_\beta=\frac23\left(\frac{\sqrt3}{2}i_b-\frac{\sqrt3}{2}i_c\right)}
$$

With $i_a+i_b+i_c=0$ this reduces to:

$$
\boxed{i_\alpha=i_a,\qquad i_\beta=\frac{i_a+2i_b}{\sqrt3}}
$$

$i_\alpha=i_a$ does not mean "Clarke did nothing"; it is the result of aligning with the A-phase axis, choosing this particular normalization, and using the zero-sum constraint.

### 3.3 A worked example you can recompute

At some instant $i_a=5$ A, $i_b=5$ A, $i_c=-10$ A:

$$
i_\alpha=5\ \mathrm A,\qquad
i_\beta=\frac{15}{\sqrt3}=8.660\ \mathrm A
$$

So the vector magnitude is 10 A at a direction of 60°. This matches the three-phase combination example in Chapter 1.

Inverting to the three phases with no zero sequence:

$$
i_a=i_\alpha,\quad
i_b=-\frac12i_\alpha+\frac{\sqrt3}{2}i_\beta,\quad
i_c=-\frac12i_\alpha-\frac{\sqrt3}{2}i_\beta
$$

Substituting back gives 5, 5, and −10 A. Forward and inverse transforms describe the same state.

### 3.4 Amplitude invariance versus power invariance

Under the transform used here, the instantaneous three-phase power is:

$$
P=u_ai_a+u_bi_b+u_ci_c
=\frac32(u_\alpha i_\alpha+u_\beta i_\beta)
=\frac32(u_di_d+u_qi_q)
$$

This assumes no zero sequence and the same transform applied to voltage and current. The $3/2$ cannot simply be dropped.

Another power-invariant Clarke puts $\sqrt{2/3}$ in front of the matrix instead; its components scale to $\sqrt{3/2}$ times those here, and the power expression then carries no $3/2$. Both are correct, but the torque formula and the current scaling have to change with the transform.

### 3.5 Why the transform cannot stop here

For the sinusoidal currents of Chapter 1, Clarke gives $i_\alpha=I_m\cos\phi$ and $i_\beta=I_m\sin\phi$, which still vary. Clarke solves the orthogonal representation; Park, in the next chapter, solves observing along with the rotor.

## Chapter 4: Park — Observing the Current with the Rotor

### 4.1 Observing from a fixed frame and from the rotor

Watch a rotating arrow from the ground and its horizontal and vertical projections keep changing. If the coordinate frame also rotates at the same speed and in the same direction, the arrow can hold still relative to that frame.

The d-axis of a PMSM is the direction of the rotor permanent-magnet flux linkage, and the q-axis leads it by 90° in the positive direction. The electrical angle $\theta_e$ is the angle from the positive $\alpha$-axis to the positive d-axis.

![Relation between the three-phase axes and the rotor frame](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/frames.png)

*Figure 2: the relation between the three phase axes and the rotor direction. [Source S1](#references-and-image-sources). The teaching figure uses equivalent axes; symbols in the text follow the conventions in the introduction.*

![The same vector expressed in different frames](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/curr_frame.png)

*Figure 3: the same current space vector can be expressed in three-phase, stationary orthogonal, and rotating coordinates. [Source S1](#references-and-image-sources). The angle labels on the right of the original differ from the notation here: this note always calls the angle from the α-axis to the d-axis θe, and the angle to the current vector φ; do not substitute the larger θel label of the original directly into the Park formulas here. The three-phase diagram on the left is an equivalent-action sketch, and its three non-orthogonal axes should not be treated as ordinary orthogonal projection axes.*

### 4.2 Deriving with unit direction vectors

The unit direction of the d-axis in the $\alpha\beta$ frame is $(\cos\theta_e,\sin\theta_e)$ and that of the q-axis is $(-\sin\theta_e,\cos\theta_e)$. Project the current onto each of the two axes:

$$
\boxed{i_d=i_\alpha\cos\theta_e+i_\beta\sin\theta_e}
$$

$$
\boxed{i_q=-i_\alpha\sin\theta_e+i_\beta\cos\theta_e}
$$

The rotation is an orthogonal transform, therefore:

$$
i_d^2+i_q^2=i_\alpha^2+i_\beta^2
$$

The transform does not manufacture current out of nothing, nor create energy.

### 4.3 Reading the d/q components through the relative angle

If the current vector has magnitude $I$ and absolute direction $\phi$:

$$
i_d=I\cos(\phi-\theta_e),\qquad
i_q=I\sin(\phi-\theta_e)
$$

This shows that the d/q currents depend on **the direction of the current vector relative to the rotor flux**. If that relative angle and the vector magnitude stay fixed, the d/q components stay constant even while the three phase currents keep changing.

Continue with $i_\alpha=5$ and $i_\beta=8.660$ A, a current direction of 60°. If the rotor d-axis sits at −30°, the current leads it by exactly 90°, giving $i_d=0$ and $i_q=10$ A.

"Becoming DC quantities" describes the coordinate components in ideal synchronous steady state; acceleration and deceleration, torque changes, harmonics, sampling noise, and PWM ripple can still move them.

![Current vector and coordinate axes](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/公式图03_电流矢量与坐标轴.png)

*Reading the figure: the orange arrow is always the same current vector. It has two nonzero components on the fixed axes, yet in the rotor frame shown it lies exactly along the q-axis, hence id = 0 and iq = 10 A. All figures here are original teaching plots computed from the formulas in the text, not measured data.*

![Waveforms from Clarke to Park](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/公式图02_Clarke到Park波形.png)

*Reading the figure: read from top to bottom — the three phase currents vary, the two components after Clarke still vary, and once the rotor frame is synchronous with the current vector and 90° away from it, Park gives constant id and iq. The three groups of curves show the same process. All figures here are original teaching plots computed from the formulas in the text, not measured data.*

### 4.4 Why the inverse Park changes signs

Recombining the d-axis and q-axis components back onto the fixed axes:

$$
\boxed{u_\alpha=u_d\cos\theta_e-u_q\sin\theta_e}
$$

$$
\boxed{u_\beta=u_d\sin\theta_e+u_q\cos\theta_e}
$$

The forward transform projects a vector onto the rotating axes; the inverse transform builds a vector from those axes. Each undoes the other. Both current and voltage can undergo these mathematical transforms; in FOC the sampled current usually gets the forward transform and the voltage command the inverse.

### 4.5 Why angle error matters so much

Suppose the true current is $i_d=0,i_q=I$ and the angle used leads the true angle by $\delta$; the controller then computes:

$$
i_d^{\mathrm{est}}=I\sin\delta,\qquad
i_q^{\mathrm{est}}=I\cos\delta
$$

At 10 A with a 10° error, about 1.736 A is taken as d-axis current. If the torque-current command itself is produced in the wrong frame, the same cross-coupling and torque loss appear.

A fixed angle offset differs from a wrong pole-pair count: the former may add a roughly constant rotation everywhere, while the latter makes the error vary with mechanical position. Diagnosis has to tell them apart.

![Components under angle error](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/公式图05_角度误差分量.png)

*Reading the figure: the left panel shows how a frame angle error mixes true q-axis current into the computed d-axis; the bars on the right correspond to the 10° error. They are two components of one vector, so the two bar heights must not be added together as a total current. All figures here are original teaching plots computed from the formulas in the text, not measured data.*

## Chapter 5: Voltage, Current, and Torque in the PMSM

This chapter explains the object the current loop actually faces. What follows uses a symmetric model with sinusoidal fundamentals and nearly constant parameters, ignoring part of the iron loss, saturation, and spatial harmonics.

### 5.1 Resistance, inductance, flux linkage, and back EMF

The resistance $R_s$ produces an $R_si$ drop and copper loss. Inductance relates current to flux linkage and makes changing the current require extra voltage. Flux linkage $\psi$ is the total flux linked by the winding, in webers; for an ideal N-turn winding where every turn links the same flux, $\psi=N\Phi$.

The relative motion of the rotor's permanent-magnet flux and the winding produces back EMF. **Back EMF is not friction, and not an extra lossy resistor conjured out of nothing; it reflects electromagnetic energy conversion.** It grows with speed and affects the terminal voltage needed to hold a target current.

In the stationary-coil model, voltage can first be understood as $u=Ri+d\psi/dt$. After the change to the rotating frame, speed-coupling terms appear that come from the rotation of the frame.

### 5.2 d-axis and q-axis flux linkage and voltage equations

$$
\psi_d=L_di_d+\psi_f,\qquad \psi_q=L_qi_q
$$

$\psi_f$ is the d-axis flux linkage produced by the magnets in this model, and $L_d,L_q$ are the inductances of the respective axes.

$$
\boxed{u_d=R_si_d+L_d\frac{di_d}{dt}-\omega_e L_qi_q}
$$

$$
\boxed{u_q=R_si_q+L_q\frac{di_q}{dt}+\omega_e(L_di_d+\psi_f)}
$$

Term by term: $R_si$ covers the resistive drop, $L\,di/dt$ changes the current, $\omega_e L i$ is the cross-coupling of the rotating frame, and $\omega_e\psi_f$ is the permanent-magnet back EMF as it appears on the q-axis.

**Even with $i_d=0$, $u_d$ is usually nonzero at speed.** In steady state it may have to equal $-\omega_e L_qi_q$ to hold the d-axis current at zero. "Command the d-axis current to zero" cannot be replaced by "fix the d-axis voltage at zero".

### 5.3 Where the torque formula comes from

Under the amplitude-invariant convention, the rotational term of the electromagnetic power conversion is:

$$
P_{\mathrm{em}}=\frac32\omega_e(\psi_di_q-\psi_qi_d)
$$

Using $P_{\mathrm{em}}=T_e\omega_m$ and $\omega_e=p\omega_m$ gives:

$$
\boxed{T_e=\frac32p[\psi_fi_q+(L_d-L_q)i_di_q]}
$$

The power argument above is intuitive at nonzero speed, and the torque expression also holds at zero speed; it can be derived from magnetic coenergy or understood as a continuous limit.

The first term is permanent-magnet torque and the second is reluctance torque. The $3/2$ matches the transform scale used, and $p$ links mechanical angle to electrical angle.

For a surface-mounted motor with $L_d=L_q$:

$$
T_e=K_ti_q,\qquad K_t=\frac32p\psi_f
$$

With $p=7$ and $\psi_f=0.01\,\mathrm{Wb}$, the torque constant defined here is $K_t=0.105\,\mathrm{N\cdot m/A}$, so at $i_q=2$ A the electromagnetic torque is 0.21 N·m. Shaft output torque is also affected by friction and iron loss, and cannot be equated to it directly.

### 5.4 Why the d-axis current is usually set to zero

For the nearly non-salient model above, with a fixed current magnitude $\sqrt{i_d^2+i_q^2}$, setting $i_d=0$ puts all of the current into permanent-magnet torque and avoids extra copper loss. That is the usual choice in basic control.

This does not mean a permanent-magnet motor "never needs d-axis current". An IPMSM can exploit reluctance torque, field weakening often needs negative $i_d$, and other optimization goals can change the current split.

### 5.5 Why higher speed runs into a voltage limit

Take $R_s=0.5\,\Omega$, $L_d=L_q=0.001\,\mathrm H$, $\psi_f=0.01\,\mathrm{Wb}$, $i_d=0$, and $i_q=2$ A.

In steady state at $\omega_e=100\,\mathrm{rad/s}$: $u_d=-0.2$ V, $u_q=2$ V, a voltage magnitude of about 2.010 V.

At $\omega_e=1000\,\mathrm{rad/s}$: $u_d=-2$ V, $u_q=11$ V, magnitude about 11.180 V. The current and torque targets have not changed, yet holding them needs more voltage.

On a 24 V bus the rotating voltage vector of ideal linear SVPWM tops out at $24/\sqrt3\approx13.856$ V. As speed rises further the controller runs out of voltage headroom and the target current no longer necessarily keeps up. Real designs also reserve margin for power-device drops, dead time, and the sampling window.

![Speed and the voltage it requires](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/公式图06_转速与电压需求.png)

*Reading the figure: the left panel uses the same parameters as the text and shows where the required voltage meets the ideal linear limit; the shaded stretch marks where the id = 0 target can no longer be met within that voltage limit. The right panel splits uq into its two terms, showing clearly that the back-EMF term is the one growing with speed; the combined magnitude on the left also includes ud. All figures here are original teaching plots computed from the formulas in the text, not measured data.*

### 5.6 Why torque does not set speed directly

$$
J\frac{d\omega_m}{dt}=T_e-T_L-B\omega_m
$$

$J$ is the equivalent moment of inertia, $T_L$ the load torque, and $B$ a simplified viscous damping coefficient. Unbalanced torque produces acceleration; once balance is reached, the speed can be constant.

The same 1 A of torque current can correspond to different speeds under different loads, and it can produce holding torque at zero speed. Current mode therefore does not by itself give a constant speed.

## Chapter 6: The Current Loop and PI

### 6.1 Why the PI output is a voltage

With $e_q=i_q^*-i_q$, when the actual current falls short the applied voltage has to be adjusted so the current moves toward the target. The PI computes:

$$
u_{q,\mathrm{PI}}=K_{p,q}e_q+K_{i,q}\int e_q\,dt
$$

The d-axis is the same. P responds to the present error at once; I accumulates error and supplies the output needed to hold steady state. With zero current error the integral output can still be nonzero, holding the voltage that covers the resistive drop.

Here $K_p$ is in V/A and $K_i$ in V/(A·s). In some code the `Ki` variable has already absorbed the sample period, so parameter values cannot be compared by variable name alone.

### 6.2 What a discrete PI actually means

Let the current-loop period be $T_s$ and store the integral state $x$ directly in volts:

$$
x[k+1]=x[k]+K_iT_se[k],\qquad
u_{\mathrm{raw}}[k]=K_pe[k]+x[k]
$$

This is one way to compute the present output from the old integral state; updating the integral before the output is also a common implementation. The two differ in timing and discrete model, and tuning has to match the implementation.

For example with $K_p=1\,\mathrm{V/A}$, $K_i=500\,\mathrm{V/(A\cdot s)}$, and $T_s=50\,\mu\mathrm s$, a steady 1 A error adds 0.025 V to the integral each period. Halve the control period while keeping the old per-period integral increment and the effective integral action doubles.

### 6.3 Initial parameters from the RL model

Under the approximation of decoupling, constant parameters, and no digital delay, one axis of the plant is:

$$
G(s)=\frac1{Ls+R_s}
$$

With a PI controller $C(s)=K_p+K_i/s$, choose:

$$
\boxed{K_p=L\omega_c,\qquad K_i=R_s\omega_c}
$$

This approximately cancels the plant's electrical pole with the PI zero; the open loop is then about $\omega_c/s$ and the closed loop about $\omega_c/(s+\omega_c)$. $\omega_c=2\pi f_c$ is the angular-frequency scale of the desired bandwidth.

For $L=1$ mH, $R_s=0.5\,\Omega$, and $f_c=500$ Hz, $K_p\approx3.142$ V/A and $K_i\approx1570.8$ V/(A·s). These are starting values under a teaching model and cannot be copied into hardware as they stand.

Digital sampling, PWM hold, computation delay, filtering, and parameter error all limit the achievable bandwidth. Running the current loop at 20 kHz does not mean 20 kHz of bandwidth. Start from a conservative bandwidth and watch the response and the noise, rather than treating any fraction of the sample rate as a stability guarantee that holds for every system.

![Ideal current-loop step response](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/公式图07_理想电流环阶跃.png)

*Reading the figure: the three curves are computed directly from the ideal first-order closed loop of this section. Higher bandwidth means a faster model response; real hardware is also constrained by delay, noise, parameter error, and voltage limiting, so this does not license unlimited bandwidth. All figures here are original teaching plots computed from the formulas in the text, not measured data.*

### 6.4 Cross-coupling and feedforward

From the model of Chapter 5, one can add:

$$
u_d^{\mathrm{raw}}=u_{d,\mathrm{PI}}-\omega_eL_qi_q
$$

$$
u_q^{\mathrm{raw}}=u_{q,\mathrm{PI}}+\omega_e(L_di_d+\psi_f)
$$

Feedforward supplies the known demand from the model in advance, and the PI corrects model error and disturbance. A loop can work without feedforward, but at high speed or during fast changes it consumes more of the feedback's regulating ability. Feedforward cannot increase the maximum voltage the bus can supply.

### 6.5 Voltage limiting and integral windup

Ideal linear SVPWM usually limits to the inscribed circle:

$$
U=\sqrt{(u_d^{\mathrm{raw}})^2+(u_q^{\mathrm{raw}})^2},\qquad
U_{\max}=k\frac{V_{dc}}{\sqrt3},\quad0<k\le1
$$

If $U>U_{\max}$, scale both axes by $U_{\max}/U$. That keeps the direction and shrinks the magnitude. The d-axis and q-axis voltages can also be prioritized according to the control objective, but clipping each axis separately to the same limit does not make the resulting magnitude compliant.

When the voltage is at its limit and the current has still not reached the target, an integral that keeps growing causes overshoot and a long recovery once control returns; this is windup.

One back-calculation anti-windup form is:

$$
x_d[k+1]=x_d[k]+T_s\{K_{i,d}e_d+K_{aw}(u_d^{\mathrm{applied}}-u_d^{\mathrm{raw}})\}
$$

The q-axis is the same. $K_{aw}$ has units of $1/\mathrm s$. Here applied means the voltage command that can finally be executed, including the overall limit after feedforward; if further clipping or a sampling-window limit occurs after the PWM stage, the effective voltage fed back should also match what is actually executed.

### 6.6 What you see when parameters change

Too little P usually makes the response slow; too much P can amplify noise or, combined with delay, cause oscillation. Too little I usually leaves steady-state error slow to disappear; too much I can add overshoot, oscillation, and recovery trouble after saturation.

Before tuning, confirm current scaling, angle, phase order, and voltage headroom. Jitter caused by a wrong angle cannot be cured by repeatedly changing the PI gains. Recording commanded and actual d/q currents, d/q voltages, saturation state, and bus voltage at the same time makes it easier to tell a control-parameter problem from a limit of the execution capability.

## Chapter 7: The Inverter, Average Voltage, and SVPWM

### 7.1 How six power switches connect three phases

A three-phase inverter has three half-bridges, and the midpoint of each connects to one motor terminal. With the upper device on, the terminal sits near the positive bus rail; with the lower device on, near the negative rail. Winding current also freewheels through MOSFET conduction paths or body diodes.

The upper and lower devices of one leg must not conduct at the same time, or the bus is shorted. The driver inserts dead time, but the inductive current does not drop to zero instantly just because switching pauses briefly.

### 7.2 Which voltage a duty cycle refers to

Taking the negative bus rail O as reference, the ideal average leg voltage is:

$$
u_{aO}=d_aV_{dc}
$$

With a floating neutral, a symmetric star-connected motor, and common-mode parasitics ignored:

$$
u_{nO}=\frac{u_{aO}+u_{bO}+u_{cO}}3,\qquad
u_{an}=u_{aO}-u_{nO}
$$

The line voltage is $u_{ab}=u_{aO}-u_{bO}=(d_a-d_b)V_{dc}$. So the leg-to-negative-bus voltage, the winding phase voltage, and the terminal-to-terminal line voltage are three different quantities.

For example with $V_{dc}=24$ V and duties 0.75, 0.25, 0.50, the leg-to-negative-bus voltages are 18, 6, and 12 V, the neutral averages 12 V, and the winding phase voltages are 6, −6, and 0 V.

### 7.3 Why an average-voltage model is allowed

When PWM switching is fast enough, the winding inductance limits how much the current can change within a single switching pulse, so control analysis can use the average voltage over one period. The current still carries switching ripple; low inductance, a low PWM frequency, or a high bus voltage makes that ripple more visible.

The average model explains the fundamental and the control dynamics; it does not replace analysis of switching spikes, device stress, and EMI.

### 7.4 Eight switching states, six active vectors

Let $(S_a,S_b,S_c)$ denote the upper-device states of the three legs, 1 for connected to the positive bus and 0 for the negative bus. There are eight combinations.

For 000 and 111 the ideal line voltages are all zero, corresponding to the zero vectors; 100, 110, 010, 011, 001, 101 give the six active vectors at 0°, 60°, 120°, 180°, 240°, and 300°, each with magnitude $2V_{dc}/3$.

A zero vector does not mean the motor current is zero, nor that the motor produces no torque. It only means the ideal line voltages are zero in that switching state; the current still freewheels and changes with the circuit state.

### 7.5 Building the target from adjacent vectors

Take the first sector, with target magnitude $U$ and angle $\gamma\in[0,\pi/3]$ from the sector start. Within one PWM period $T_{\mathrm{PWM}}$:

$$
\boldsymbol U T_{\mathrm{PWM}}=\boldsymbol V_1T_1+\boldsymbol V_2T_2
$$

Comparing along the two axes and solving the equations gives:

$$
\boxed{T_1=\frac{\sqrt3UT_{\mathrm{PWM}}}{V_{dc}}\sin(\pi/3-\gamma)}
$$

$$
\boxed{T_2=\frac{\sqrt3UT_{\mathrm{PWM}}}{V_{dc}}\sin\gamma,\quad
T_0=T_{\mathrm{PWM}}-T_1-T_2}
$$

When all the times are non-negative, the target can be synthesized as the average of these states over the period. The largest radius that stays in the linear region for every rotation angle is $V_{dc}/\sqrt3$, the inscribed circle of the hexagon; particular directions can reach further out toward the vertices, but the maximum vertex radius is not a constant magnitude available in all directions.

For example with $V_{dc}=24$ V, $U=6$ V, $\gamma=30°$, and $T_{\mathrm{PWM}}=50\,\mu s$:

$$
T_1=T_2\approx10.825\,\mu s,\qquad T_0\approx28.349\,\mu s
$$

Using the symmetric seven-segment sequence of the first sector, 000→100→110→111→110→100→000, with the two zero states each taking half of the total zero time, gives:

$$
d_a=\frac{T_1+T_2+T_0/2}{T_{\mathrm{PWM}}},\quad
d_b=\frac{T_2+T_0/2}{T_{\mathrm{PWM}}},\quad
d_c=\frac{T_0/2}{T_{\mathrm{PWM}}}
$$

The values are about 0.7165, 0.5000, and 0.2835. Other sectors need their states reordered accordingly; the phase relation of the first sector cannot be applied all the way around.

![SVPWM vectors and timing](https://assets.virongx.com/blog/posts/2026/Motor-FOC-fundamentals/公式图08_SVPWM矢量与时间.png)

*Reading the figure: the six vertices on the left correspond to the active switching states, and the dashed circle is the linear amplitude boundary that holds in every direction. The right panel turns T1, T2, and T0 of the earlier 6 V, 30° example into bar lengths; the total zero time can be split among different zero states and sequence positions. All figures here are original teaching plots computed from the formulas in the text, not measured data.*

### 7.6 min/max injection, easier to put in code

First use inverse Clarke to get zero-sum phase-voltage commands:

$$
u_a=u_\alpha,\quad
u_b=-\tfrac12u_\alpha+\tfrac{\sqrt3}{2}u_\beta,\quad
u_c=-\tfrac12u_\alpha-\tfrac{\sqrt3}{2}u_\beta
$$

Then compute the common-mode offset:

$$
u_0=-\frac{\max(u_a,u_b,u_c)+\min(u_a,u_b,u_c)}2
$$

$$
\boxed{d_x=\frac12+\frac{u_x+u_0}{V_{dc}},\quad x\in\{a,b,c\}}
$$

Adding the same voltage to all three phases leaves the line voltages unchanged while making better use of the bus. In the linear region, with a matching center-aligned switching arrangement, this method has equivalent average voltages and duty cycles to center-symmetric SVPWM; it does not by itself prescribe every detail of the actual switching sequence.

For the earlier example with $U=6$ V at 30°, $u_\alpha=5.196$ V and $u_\beta=3$ V; inverse Clarke gives 5.196, 0, and −5.196 V, the common-mode offset is 0, and the same three duty cycles come out.

### 7.7 SPWM, voltage utilization, and overmodulation

For sinusoidal PWM without common-mode injection, keeping the three duty cycles within 0 to 1 caps the fundamental phase-voltage peak at $V_{dc}/2$. Linear SVPWM raises it to $V_{dc}/\sqrt3$, an ideal ratio of $2/\sqrt3\approx1.1547$, about 15.5%.

This is not voltage out of nowhere; it redistributes the common mode so that the allowable leg-voltage range is used more fully. Beyond the linear region comes overmodulation, where the fundamental gain relation changes and harmonics increase, and the linear model no longer explains the behavior directly.

### 7.8 Dead time and minimum pulse width

During dead time the phase-terminal potential is influenced by current direction and the freewheeling path, which biases the actual average voltage. The rough magnitude relates to $V_{dc}t_{\mathrm{dead}}/T_{\mathrm{PWM}}$; the exact coefficient depends on the switching timing and the definition.

Dead time, device drops, and judging current direction near zero all affect the waveform at low speed and low current. Some drivers need refresh conditions for their bootstrap supply, and the ADC needs a conduction window, so real hardware may not allow a steady 0% or 100% duty cycle.

## Chapter 8: Running the Whole FOC Loop on an MCU

### 8.1 Turning an ADC reading into amperes

With a shunt resistor and a linear amplifier:

$$
i=\frac{V_{\mathrm{ADC}}-V_{\mathrm{offset}}}{G R_{\mathrm{shunt}}},\qquad
V_{\mathrm{ADC}}\approx\frac{N}{2^b-1}V_{\mathrm{ref}}
$$

$N$ is the ADC code, $b$ the bit count, and $G$ the amplifier gain. Real calibration also has to account for ADC gain, reference-voltage error, amplifier offset, and sensor polarity.

For example with 12 bits, a 3.3 V reference, $R_{\mathrm{shunt}}=0.01\,\Omega$, $G=20$, a zero-point code of 2048, and a reading 248 codes above zero, the current is about:

$$
i\approx\frac{248\times3.3/4095}{20\times0.01}=0.999\ \mathrm A
$$

The zero point should be estimated from several samples taken with no actual current flowing. A current that keeps flowing must not be subtracted as if it were offset.

### 8.2 One shunt, two shunts, three shunts, and in-phase sensing

Low-side shunts in all three legs make it easier to pick a usable channel, but a measurement is only possible when the corresponding current path and amplifier settling window both allow it. Two low-side shunts usually measure two phases and reconstruct the third from the zero-sum constraint. A single bus shunt measures bus current in different active switching states and reconstructs the phase currents from those, which demands precise placement of the sampling window.

An in-phase current sensor does not depend on the low-side conduction window, but it may face larger common-mode variation and higher bandwidth requirements.

**Fitting three shunts does not mean three correct currents are available at any instant.** As the modulation index approaches its limit the valid window shrinks, and sampling and reconstruction can become the limit, rather than the ADC conversion speed being insufficient.

### 8.3 Why PWM and ADC must be synchronized

Spikes, ringing, and amplifier recovery surround every switching edge, so the ADC should sample in a valid and settled current window. Center-aligned PWM often makes that easy to arrange, but "always sample at the counter midpoint" cannot be copied directly without regard to topology, duty cycle, and conduction state.

If two phase currents are not measured at the same instant, forcing them to be simultaneous introduces transform error when the current changes quickly. Sample-and-hold, conversion, computation, writing the compare register, and loading the PWM shadow register all form part of the real timing.

### 8.4 What angle calibration has to calibrate

Four things have to be made consistent: phase sequence, current polarity, sensor direction, and the electrical-angle zero. An encoder's 0° is not necessarily the position where the d-axis lines up with the A-phase axis.

One common approach applies a stator current in a known direction, under controlled and current-limited conditions, so the rotor aligns, then records the sensor angle. Load, friction, cogging torque, and insufficient current cause alignment error; some systems need calibration at several positions.

The controller can be written as:

$$
\theta_e=\operatorname{wrap}_{2\pi}(p\,s\theta_m+\theta_0)
$$

Here $s=\pm1$ captures the defined sensor direction relation. The sign of speed must also follow the same convention.

### 8.5 The angle for sampling and the angle for applying voltage

Park should use the angle that corresponds to the instant the current was sampled. Inverse Park has to consider the rotor direction at the moment the voltage is actually applied. If the expected effective delay is $T_d$, one approximate compensation is:

$$
\theta_{\mathrm{apply}}\approx\theta_{\mathrm{sample}}+\omega_eT_d
$$

It depends on a speed estimate and on explicit timing; adding a fixed 90° or some arbitrary empirical angle without grounds is not acceptable. When low speed is barely affected but high speed misbehaves clearly, both the time delay and the electrical-speed conversion are worth checking.

### 8.6 Pseudocode for one current-loop interrupt

```text
Read valid ADC data and convert to A with zero offset, gain, and polarity
Read or interpolate the mechanical angle at the sampling instant, convert to electrical angle
Reconstruct the missing phase current according to the sensing topology
Clarke: ia, ib, ic → i_alpha, i_beta
Park (sampling angle): i_alpha, i_beta → id, iq
Read the already-limited id_ref, iq_ref
Compute ed, eq and the raw outputs of both PIs
Add cross-coupling and back-EMF feedforward from the model
Limit the combined voltage using the measured Vdc
Update anti-windup and the integral states with the finally applied voltage
Estimate the voltage application angle, run inverse Park
Inverse Clarke + min/max injection, compute the three duty cycles
Combine the sampling window, minimum pulse width, and so on into executable duties
If further limits change the voltage, use the final effective voltage for limit feedback
Write the PWM shadow registers, wait for the specified update instant
Record a few diagnostic values, end this interrupt
```

The pseudocode shows the data flow; the exact integral-state update, limit feedback, and PWM timing should be implemented as one consistent design. Communication, UI refresh, and heavy logging must not block the real-time current loop.

### 8.7 Following the numbers from sample to PWM

To make checking easy, this example takes a stationary instant and ignores feedforward and delay. The samples are $i_a=0$, $i_b=0.8660$, $i_c=-0.8660$ A with $\theta_e=0$.

Clarke gives $i_\alpha=0,i_\beta=1$ A; Park gives $i_d=0,i_q=1$ A. The targets are $i_d^*=0,i_q^*=2$ A, so the errors are 0 and 1 A.

If both integral states start at zero and $K_{p,q}=1$ V/A, this period computes $u_d=0,u_q=1$ V. Inverse Park gives $u_\alpha=0,u_\beta=1$ V, and inverse Clarke gives:

$$
u_a=0,\quad u_b=0.8660,\quad u_c=-0.8660\quad(\mathrm V)
$$

With a 24 V bus and zero common-mode offset, the duty cycles are 0.5000, 0.5361, and 0.4639. How the actual current changes in the next period still depends on resistance, inductance, back EMF, and the previous period's voltage, so these three duty cycles alone cannot establish that "the current already equals the target".

## Chapter 9: Speed Loop, Position Loop, and Operating Limits

### 9.1 How the speed loop feeds the current loop

The speed controller compares $\omega_m^*$ with $\omega_m$ and outputs torque or $i_q^*$. In the nearly non-salient model, a torque output converts via $i_q^*=T_e^*/K_t$.

A heavier load lowers the speed, the speed error drives the torque current up, and the current loop then adjusts voltage so the actual current follows the new target. The outer loop's output needs current limiting and anti-windup, or the outer loop will also wind up when the demand exceeds what the motor can deliver.

### 9.2 Why the inner loop is usually faster

The outer loop wants "the current target it hands down to be realized quickly", so the current loop is usually designed faster than the speed loop, and the position loop is then arranged according to the mechanical system and the goal.

Inner and outer bandwidths usually need clear separation, but no fixed ratio is universal when mechanical resonance, sampling delay, and control structure are ignored. Over-filtering the speed estimate also introduces delay and affects speed-loop stability.

### 9.3 What the position loop actually controls

A position loop can turn position error into a speed target, with the speed loop then producing the current target; there are also structures in which position error produces torque directly, together with speed feedback.

Position error has to distinguish accumulated multi-turn position from a single-turn periodic angle. Within one turn, 359° to 1° can take the 2° path across zero; a multi-turn task cannot simply wrap every error into ±180°.

### 9.4 Current limit and voltage limit are two boundaries

$$
i_d^2+i_q^2\le I_{\max}^2,\qquad
u_d^2+u_q^2\le U_{\max}^2
$$

The first relates to the devices, the motor's thermal capability, and magnetic saturation; the second is governed mainly by the bus, the modulation scheme, and engineering margin. Together the two constraints determine the achievable torque and speed range.

Field weakening uses part of the d-axis current allowance, and the remaining usable q-axis current is usually reduced. Setting a larger target current does not solve a shortage of voltage.

### 9.5 Stall, holding, and generating braking

At zero speed there can be nonzero electromagnetic torque while the output mechanical power $T_e\omega_m$ is zero, and the winding still has copper loss. Low mechanical power is therefore not low heating.

When $T_e\omega_m<0$, the electromagnetic torque resists the motion and mechanical energy can be returned to the DC bus. If the supply cannot absorb the regenerated energy, the bus capacitor voltage rises, and the system needs an arrangement for absorbing that energy or for braking.

Regenerative braking, dynamic braking, and mechanical braking send the energy to different places. Judging the generating state takes the signs of both torque and speed, not just whether $i_q$ is negative.

## Chapter 10: Common Symptoms and Advanced Control

### 10.1 Jitter, reversed rotation, starting only at some positions

Check the electrical angle, phase sequence, current polarity, and sensor direction first. A wrong pole-pair count causes position-dependent error, and a fixed zero offset cross-couples the d/q components. Then check the valid sampling window and the control timing, and finally assess parameters and mechanical factors.

The same jitter can come from different causes. Recording mechanical angle, electrical angle, three-phase currents, and d/q currents together is usually more valuable than watching only whether it turns.

### 10.2 Large no-load current, heating, little torque

What may be involved: angle deviation, wrong offset or gain, ineffective d-axis current, mechanical friction, cogging, PWM ripple, or harmonics. No load still means losses have to be overcome, so the actual current cannot be required to be zero.

Average DC bus current is neither the phase-current peak nor $i_q$. With a large holding current at zero speed, the average bus current may be far below the phase current, because of freewheeling in the windings and the lower terminal voltage; power conservation still holds.

### 10.3 Visible d/q current ripple

Possible causes are current-sampling noise, periodic angle error, mismatched three-phase gains, dead-time distortion, non-sinusoidal back EMF, or loop oscillation. Looking at how the ripple frequency relates to the electrical, mechanical, and PWM frequencies helps separate the sources, but a frequency signature alone cannot prove a single cause.

Do not reach first for a very strong low-pass filter to flatten the waveform. Filtering adds delay, and a smoother display does not mean better control.

### 10.4 Fine at low speed, current falling behind at high speed

First see whether the voltage vector is near its limit and whether the bus is sagging, then look at angle delay, sensor communication bandwidth, the sampling window, feedforward, and the electrical-speed conversion. Once voltage is saturated, raising the PI gains further cannot create voltage headroom.

### 10.5 The current loop is fine but the speed loop still oscillates

Speed-estimate noise, filter delay, the speed PI, targets that change too fast, inertia variation, mechanical compliance, and gear backlash can all take part. Outer-loop tuning rests on an inner loop that already works reliably; a position loop also has to consider mechanical resonance and drivetrain flexibility.

### 10.6 Field weakening: lowering the voltage high speed needs

Under the conventions of this note, negative $i_d$ lowers $\psi_d=L_di_d+\psi_f$ and reduces the voltage needed at a given speed, extending the speed range when voltage is the limit.

Field weakening does not mean the controller changes the magnets' magnetism at will; normal control mainly uses opposing stator MMF to reduce the effective flux linkage. Excessive current in the demagnetizing direction, temperature, and other factors can cause irreversible demagnetization, so the current boundary has to follow the motor design.

Field weakening also needs current and voltage constraints, control transitions, and management of the available torque; fixing a negative d-axis current is not enough to call it done.

### 10.7 MTPA: more torque from the same current

MTPA is maximum torque per ampere. For the basic model with $L_d=L_q$, its solution is $i_d=0$. For a typical IPMSM with $L_q>L_d$, at positive $i_q$ a suitable negative $i_d$ makes the reluctance torque term positive, so the optimal current direction departs from the pure q-axis.

If parameters are nearly constant and the current magnitude $I$ is fixed, let $\Delta=L_d-L_q$; the extremum condition is:

$$
2\Delta i_d^2+\psi_fi_d-\Delta I^2=0
$$

Choose the branch that tends continuously to zero as the current approaches zero and that corresponds to maximum torque:

$$
i_d=\frac{-\psi_f+\sqrt{\psi_f^2+8\Delta^2I^2}}{4\Delta},\qquad
i_q=\sqrt{I^2-i_d^2}
$$

This expression serves to show the trend of the ideal model; as $\Delta\to0$ take the limit $i_d\to0$, and implementations also have to avoid numerical cancellation. Real saturation, cross-saturation, and parameter variation often call for lookup tables or online optimization. MTPA optimizes torque per ampere, which is not the same as the highest overall efficiency in every operating point once iron and inverter losses are included.

### 10.8 Sensorless FOC: what is replaced is how the angle is obtained

Sensorless control estimates the rotor flux direction or position from voltage, current, and the motor model, and supplies it to the coordinate transforms and the controller. Back-EMF methods have a weak signal at low speed, especially at zero speed, so they usually need a dedicated starting strategy; where saliency exists, methods such as high-frequency injection are worth considering.

Sensorless does not mean current is not measured, and it does not mean simply rotating the voltage vector at a preset speed. While open-loop startup has not yet reliably obtained the rotor position, it cannot be assumed to have the same torque-control capability as an oriented closed-loop state.

## Reference: Look Things Up by Topic

### A. Mathematics

**Projection and the dot product.** The component of a vector along a unit axis equals the dot product with that axis's unit direction; the two Park formulas are two dot products.

**Rotation matrix.** $R(\theta)=\begin{bmatrix}\cos\theta&-\sin\theta\\\sin\theta&\cos\theta\end{bmatrix}$. Inverse Park uses $R(\theta)$ and Park uses $R(-\theta)$. Its inverse matrix equals its transpose.

**Differentiation and integration.** $di/dt$ is how fast the current changes; $\int e\,dt$ is the accumulation of error over time. A digital integral adds each period's error multiplied by time, and the sample period cannot be ignored.

**Complex form.** One can write $i_s=i_\alpha+j i_\beta$, and Park is equivalent to multiplying by $e^{-j\theta_e}$. This is a compact expression; it does not mean the current has gained a "fictitious part".

**Transfer functions and bandwidth.** A transfer function describes input-output dynamics in the linear approximation. Bandwidth reflects the ability to follow changes; too much bandwidth combined with delay reduces stability margin.

**Angle wrapping.** A single-turn angle can be wrapped into $[0,2\pi)$; zero crossings have to be handled before computing speed, or 359° to 1° is misread as one large jump backwards. Multi-turn angles usually need unwrapping and accumulation.

### B. Circuits and power

**Kirchhoff's current law.** The algebraic sum of currents into a node is zero; this is the basis of three-wire current reconstruction, not a property unique to trigonometric identities.

**RL time constant.** For a stationary single axis, approximately $Ldi/dt+Ri=u$, with time constant $\tau=L/R$. It describes the natural current dynamics; a closed loop can speed the response up, but is constrained by voltage and delay.

**Star and delta.** In star, the phase current equals the line current; in balanced sinusoidal steady state, the line-voltage RMS is $\sqrt3$ times the winding phase-voltage RMS. In delta, the line voltage equals the winding terminal voltage while the line current differs from the winding current. The phase currents of the three-wire transform in this note are motor terminal currents by default; internal delta branch quantities cannot be substituted without conversion.

**Resistance between two terminals.** An ideal star motor measures about $2R_{\mathrm{phase}}$ terminal to terminal; an ideal symmetric delta measures about $2R_{\mathrm{winding}}/3$. With the connection unknown, a multimeter reading between terminals cannot be taken directly as the model's phase resistance. Inductance measurement also involves mutual inductance, rotor position, and test frequency, and the conversion cannot simply follow the resistance relation.

**Copper loss.** For balanced sinusoidal current, $P_{\mathrm{Cu}}=3R_sI_{\mathrm{phase,rms}}^2=\tfrac32R_s(i_d^2+i_q^2)$. Harmonics add extra RMS and extra loss.

**Bus current.** In the cycle-average sense, and ignoring losses, $V_{dc}I_{dc}\approx\tfrac32(u_di_d+u_qi_q)$. Current values cannot be equated directly between different points in the circuit.

### C. Electromagnetics and mechanics

**Flux and flux linkage.** Flux $\Phi$ describes the magnetic flux crossing an area; flux linkage $\psi$ accounts for the winding turns and the linking relation. Flux density B is in T and cannot be mixed up with flux linkage.

**Magnetic saturation.** As current increases the magnetic circuit stops being linear, and inductance and the optimal current angle may change. A constant-parameter model is suitable for explaining principles; precise control may need a model whose parameters vary with the operating point.

**Cogging torque and torque ripple.** Cogging torque comes from reluctance variation between the permanent magnets and the slot teeth and can exist even without current; current harmonics, back-EMF harmonics, and dead time cause other torque ripple.

**Inertia and gearboxes.** With an ideal reduction ratio $N=\omega_{\mathrm{motor}}/\omega_{\mathrm{load}}$, the load inertia reflected to the motor side is $J_L/N^2$. In practice transmission efficiency, backlash, and compliance also matter, and output torque is not the motor's electromagnetic torque amplified losslessly.

### D. Control and digital implementation

**Low-pass filtering.** A first-order discrete form can be written $y[k]=ay[k-1]+(1-a)x[k]$, with one matching choice for an analog first-order pole being $a=e^{-2\pi f_{\mathrm{cut}}T_s}$. A lower cutoff is usually smoother, but the dynamic lag is more pronounced.

**PWM frequency, sampling frequency, control update frequency.** The three may be the same, or related by multiplication or division, and each must be stated separately. A speed loop's update frequency is not its bandwidth either.

**Feedforward and feedback.** Feedforward supplies the demand in advance from the model; feedback corrects according to actual error. Inaccurate feedforward parameters do not mean feedback has failed completely, but they may increase its burden.

**Software current limiting and hardware overcurrent.** Clamping the current target limits only the request and cannot guarantee that instantaneous current stays within limits under any fault. Hardware comparators, driver protection, and the PWM shutdown path handle the faster fault processes.

### E. Hardware and sensors

**Bootstrap.** Some high-side drivers are powered from a bootstrap capacitor and need specific refresh conditions; whether a sustained high duty cycle is allowed depends on the driver architecture.

**Current-sense amplifier.** Look at gain, but also at offset, bandwidth, slew rate, common-mode range, and recovery time after switching disturbance. High ADC resolution does not mean the whole measurement chain is accurate.

**Position sensors.** Encoders, magnetic encoders, Hall sensors, and the like differ in resolution and latency. Interpolation can improve some estimates but cannot unconditionally make up for a genuine shortage of information. SPI/I²C communication time has to be counted in the control timing.

### F. Symbols and parameters that are easily confused

- $i_a,i_b,i_c$: instantaneous three-phase terminal currents; $i_\alpha,i_\beta$: stationary orthogonal components; $i_d,i_q$: rotating-frame components, all in A.
- $u_d,u_q$: voltage components in V; they are neither raw ADC codes nor duty cycles.
- $\theta_m,\theta_e$: mechanical angle and electrical angle; $\omega_m,\omega_e$: the corresponding angular velocities in rad/s.
- $p$: number of pole pairs; the total magnet pole count is $2p$. Fourteen poles cannot be taken directly as fourteen pole pairs.
- $T_e$: torque; $T_s$: control period; $T_{\mathrm{PWM}}$: PWM period — do not confuse them just because they all start with T.
- $\psi_f$: permanent-magnet flux linkage; $L_d,L_q$: axis inductances; $R_s$: model phase resistance.
- $K_t$: torque constant, and it must be stated whether the current is phase RMS, peak, or on the q-axis scale used here.
- $K_v$: commonly in rpm/V; before converting it to $K_e$ or $K_t$, confirm whether the voltage is line or phase, RMS or peak, and what the speed test conditions were. Those factors cannot be ignored and the reciprocal applied directly.

## References and Image Sources

The main text is reorganized, derived, and worked through under the notation used throughout this note. A few statements in the references present "keep 90° apart" or "the d-axis current is zero" as simplified conclusions; here they are restricted to the corresponding models and operating conditions and cannot be generalized to all PMSM control.

- **S1: SimpleFOC documentation, Coordinate Transformations in FOC.** [Original](https://docs.simplefoc.com/foc_theory). Used to check the coordinate transforms and the background of the images; this post uses three of its figures, `frames.png`, `curr_frame.png`, and `FOC_6_step_modulation.gif`. The page footer declares an MIT license; individual images carry no separate license mark, so attribution and the upstream notice are preserved without inferring a separate grant. Exact original image links and license records are kept in the notes file in the image directory.
- **S2: SimpleFOC documentation, Voltage Torque Control.** [Original](https://docs.simplefoc.com/voltage_torque_control). Used to compare the relations among voltage control, back EMF, the current loop, and feedforward. The numbers and derivations in the text do not copy that page's library parameters.

The two images from the original notes remain in the image directory. Because the original file provides no verifiable source or license for them, this version does not use them as evidence in the text or as additional figures. The original content is preserved in full in the backup file in the same directory.

**Last updated: November 26, 2026 00:25:35**
