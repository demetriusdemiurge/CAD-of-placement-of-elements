EESchema Schematic File Version 4
EELAYER 30 0
EELAYER END
$Descr A4 11693 8268
encoding utf-8
Sheet 1 1
Title "Example Circuit"
Date "2024-01-01"
Rev "1.0"
Comp ""
Comment1 ""
Comment2 ""
Comment3 ""
Comment4 ""
$EndDescr
$Comp
L Device:R R1
U 1 1 60000001
P 2000 2000
F 0 "R1" H 2070 2046 50  0000 L CNN
F 1 "10k" H 2070 1955 50  0000 L CNN
F 2 "" V 1930 2000 50  0001 C CNN
F 3 "" H 2000 2000 50  0001 C CNN
	1    2000 2000
	1    0    0    -1  
$EndComp
$Comp
L Device:C C1
U 1 1 60000002
P 3000 2000
F 0 "C1" H 3115 2046 50  0000 L CNN
F 1 "100n" H 3115 1955 50  0000 L CNN
F 2 "" H 3038 1850 50  0001 C CNN
F 3 "" H 3000 2000 50  0001 C CNN
	1    3000 2000
	1    0    0    -1  
$EndComp
$Comp
L Device:R R2
U 1 1 60000003
P 4000 2000
F 0 "R2" H 4070 2046 50  0000 L CNN
F 1 "4.7k" H 4070 1955 50  0000 L CNN
F 2 "" V 3930 2000 50  0001 C CNN
F 3 "" H 4000 2000 50  0001 C CNN
	1    4000 2000
	1    0    0    -1  
$EndComp
Wire Wire Line
	2000 1850 3000 1850
Wire Wire Line
	3000 1850 4000 1850
Wire Wire Line
	2000 2150 3000 2150
Wire Wire Line
	3000 2150 4000 2150
$EndSCHEMATC
