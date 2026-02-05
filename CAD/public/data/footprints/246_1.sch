EESchema Schematic File Version 2  date 07.10.2025 13:44:23
LIBS:power
LIBS:device
LIBS:transistors
LIBS:conn
LIBS:linear
LIBS:regul
LIBS:74xx
LIBS:cmos4000
LIBS:adc-dac
LIBS:memory
LIBS:xilinx
LIBS:special
LIBS:microcontrollers
LIBS:dsp
LIBS:microchip
LIBS:analog_switches
LIBS:motorola
LIBS:texas
LIBS:intel
LIBS:audio
LIBS:interface
LIBS:digital-audio
LIBS:philips
LIBS:display
LIBS:cypress
LIBS:siliconi
LIBS:opto
LIBS:atmel
LIBS:contrib
LIBS:valves
LIBS:246_1
LIBS:246_1-cache
EELAYER 25  0
EELAYER END
$Descr A4 11700 8267
encoding utf-8
Sheet 1 1
Title ""
Date "7 oct 2025"
Rev ""
Comp ""
Comment1 ""
Comment2 ""
Comment3 ""
Comment4 ""
$EndDescr
$Comp
L K555TB6 DD1
U 2 1 68D26FD4
P 15300 9400
F 0 "DD1" H 15350 9450 60  0000 C CNN
F 1 "K555TB6" H 8050 13400 60  0000 C CNN
	2    15300 9400
	1    0    0    -1  
$EndComp
$Comp
L K555TB6 DD1
U 1 1 68D26FD0
P 15300 7450
F 0 "DD1" H 15350 7500 60  0000 C CNN
F 1 "K555TB6" H 8050 11450 60  0000 C CNN
	1    15300 7450
	1    0    0    -1  
$EndComp
Wire Wire Line
	7150 3150 7150 3400
Wire Wire Line
	5250 3100 5950 3100
Wire Wire Line
	6150 4500 7450 4500
Wire Wire Line
	7450 5100 7200 5100
Wire Wire Line
	5950 3700 5250 3700
Wire Wire Line
	6400 5100 6400 5250
Wire Wire Line
	7150 3150 7450 3150
Wire Wire Line
	6150 2950 7450 2950
Wire Wire Line
	8650 4500 8950 4500
Wire Wire Line
	8950 4500 8950 5600
Wire Wire Line
	7450 2750 6350 2750
Wire Wire Line
	6350 2750 6350 4700
Wire Wire Line
	6350 4700 7450 4700
Wire Bus Line
	6050 5200 6050 2150
Wire Wire Line
	8650 2550 8950 2550
Wire Wire Line
	8950 2550 8950 4000
Wire Wire Line
	8950 4000 7150 4000
Wire Wire Line
	7150 4000 7150 4900
Wire Wire Line
	7150 4900 7450 4900
Wire Wire Line
	6150 2550 7450 2550
Wire Wire Line
	5250 4600 5650 4600
Wire Wire Line
	5650 4600 5650 5600
Wire Wire Line
	5650 5600 8950 5600
Wire Wire Line
	5250 4300 6350 4300
Connection ~ 6350 4300
Wire Wire Line
	5250 2800 5250 2600
Wire Wire Line
	5250 4000 5950 4000
Wire Wire Line
	5250 4900 5250 5100
Wire Wire Line
	7150 3400 5250 3400
Text Notes 6100 2450 0    79   ~ 0
1
Text Notes 6100 2850 0    79   ~ 0
3
Text Notes 6150 4450 0    79   ~ 0
2
Text Notes 5900 3950 0    79   ~ 0
3
Text Notes 5900 3650 0    79   ~ 0
2
Text Notes 5900 3050 0    79   ~ 0
1
$Comp
L VCC #PWR01
U 1 1 68D1A28F
P 5250 5100
F 0 "#PWR01" H 5250 5200 30  0001 C CNN
F 1 "VCC" H 5250 5200 30  0000 C CNN
	1    5250 5100
	-1   0    0    1   
$EndComp
$Comp
L GND #PWR02
U 1 1 68D1A28B
P 5250 2600
F 0 "#PWR02" H 5250 2600 30  0001 C CNN
F 1 "GND" H 5250 2530 30  0001 C CNN
	1    5250 2600
	-1   0    0    1   
$EndComp
$Comp
L GND #PWR03
U 1 1 68D1A282
P 6400 5250
F 0 "#PWR03" H 6400 5250 30  0001 C CNN
F 1 "GND" H 6400 5180 30  0001 C CNN
	1    6400 5250
	1    0    0    -1  
$EndComp
$Comp
L CONNECT X1
U 1 1 68D165C1
P 3750 3200
F 0 "X1" H 4150 4200 60  0000 C CNN
F 1 "CONNECT" H 4200 1300 60  0000 C CNN
	1    3750 3200
	1    0    0    -1  
$EndComp
Text Notes 4000 3100 0    79   ~ 0
J1
Text Notes 4000 3400 0    79   ~ 0
R
Text Notes 4000 3700 0    79   ~ 0
J2
Text Notes 4000 4000 0    79   ~ 0
K1
Text Notes 4000 4300 0    79   ~ 0
C
Text Notes 3950 4600 0    79   ~ 0
OUT
Entry Wire Line
	5950 3100 6050 3000
Entry Wire Line
	5950 3700 6050 3600
Entry Wire Line
	5950 4000 6050 3900
Entry Wire Line
	6050 4400 6150 4500
Entry Wire Line
	6050 2850 6150 2950
Entry Wire Line
	6050 2450 6150 2550
$Comp
L REZ R1
U 1 1 68D16E05
P 6850 5100
F 0 "R1" H 6800 5250 60  0000 C CNN
F 1 "REZ" H 6800 5000 60  0000 C CNN
	1    6850 5100
	1    0    0    -1  
$EndComp
$EndSCHEMATC
