# Device Failure Analysis Report
**Date Generated:** 2026-01-02 09:51:52
**Period:** 2025-12-19 to 2026-01-02
**Total Active Devices:** 505

## Summary Statistics
| Category | Count | Description |
|---|---|---|
| Power Failure | 16 | Battery < 3.5V or persistent low voltage |
| Transmission Issue | 43 | Good Battery (>3.7V) but Low Uptime (<50%) |
| Component Failure | 10 | Avg Error Margin > 20.0 |
| Dead | 354 | No data > 7 days |
| Healthy | 82 |  |


## Power Failure (16 Devices)
| Device Name | ID | Avg Batt (V) | Last Batt (V) | Uptime (%) | Avg Error | Last Seen | Reason |
|---|---|---|---|---|---|---|---|
| airqo-g5138 | `63e131282338cc0029c572ea` | 3.43 | **3.2** | 7.7 | 19.4 | 2025-12-28 | Low Battery |
| aq_g0_1 | `6249c7cdc00719a17427c52c` | 3.16 | **3.23** | 30.7 | 0.0 | 2025-12-25 | Low Battery |
| aq_g5_58 | `624d3deb994194001ddccede` | 3.32 | **3.29** | 15.8 | 2.11 | 2025-12-27 | Low Battery |
| airqo_g5293 | `654b2437b32754001326deac` | 3.76 | **3.3** | 44.3 | 10.51 | 2025-12-31 | Low Battery |
| aq_83 | `5f2036bc70223655545a8b8b` | 3.96 | **3.35** | 42.6 | 5.02 | 2025-12-27 | Low Battery |
| aq_g5_115 | `637e007d7c737c001e799ef3` | 3.8 | **3.38** | 81.5 | 22.55 | 2025-12-31 | Low Battery |
| airqo_g5372 | `66dea281c0437500130e7d72` | 3.47 | **3.39** | 5.1 | 2.76 | 2025-12-27 | Low Battery |
| airqo_g5409 | `67a336ea4b0adb001333097f` | 3.97 | **3.39** | 50.9 | 1.87 | 2025-12-27 | Low Battery |
| airqo_g5203 | `64934593a2365e001e63598a` | 3.65 | **3.41** | 32.7 | 10.49 | 2025-12-28 | Low Battery |
| airqo_g5387 | `67a31bc38ab7f2001374cee0` | 3.91 | **3.41** | 50.6 | 2.33 | 2025-12-27 | Low Battery |
| aq_g5_63 | `624d3fd2994194001ddccf37` | 4.09 | **3.45** | 46.7 | 3.94 | 2025-12-27 | Low Battery |
| airqo_g5335 | `6633610154098f0013dc87c1` | 3.68 | **3.48** | 18.8 | 3.62 | 2025-12-27 | Low Battery |
| airqo_g5390 | `67a31defe30c2600123c871a` | 3.45 | **3.5** | 4.5 | 2.08 | 2025-12-27 | Low Battery |
| airqo_g5305 | `654b2703b32754001326df49` | 3.68 | **3.57** | 38.7 | 4.23 | 2025-12-31 | Low Uptime & Mediocre Battery |
| airqo_g5388 | `67a31c148ab7f2001374cefa` | 3.48 | **3.65** | 1.5 | 1.33 | 2025-12-27 | Low Battery |
| airqo-g5135 | `63e0eecc3d2d33001e523ecb` | 3.67 | **3.72** | 7.4 | 5.18 | 2025-12-31 | Low Uptime & Mediocre Battery |

## Transmission Issue (43 Devices)
| Device Name | ID | Avg Batt (V) | Last Batt (V) | Uptime (%) | Avg Error | Last Seen | Reason |
|---|---|---|---|---|---|---|---|
| airqo_g5418 | `67a33b381db5a50013aa67f7` | 4.1 | **4.03** | 2.4 | 1.68 | 2025-12-27 | Low Uptime with Good Battery |
| aq_g5_55 | `61b7329ba1c2cb001ebd56e5` | 3.82 | **3.86** | 15.2 | 188.08 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5204 | `649345a0a2365e001e635991` | 4.1 | **4.12** | 16.4 | 10.18 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5472 | `67d1470d13e5ea001494f9a5` | 4.25 | **4.26** | 21.4 | 7.17 | 2025-12-25 | Low Uptime with Good Battery |
| aq_g5_70 | `624d42a6994194001ddcd041` | 3.97 | **3.86** | 22.9 | 11.47 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5509 | `6825aea38eb1420013d2b9d2` | 4.0 | **3.94** | 24.4 | 0.74 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5195 | `6492a7b94ff802001e0be05c` | 4.23 | **4.23** | 25.3 | 1.55 | 2025-12-28 | Low Uptime with Good Battery |
| airqo_g5556 | `686383b1339f1b0013a7ed8c` | 3.94 | **3.9** | 25.9 | 2.47 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5554 | `6863838a0aef8b001385ce63` | 3.89 | **3.83** | 26.2 | 4.16 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5508 | `6825ae9ae9a8820013154ff0` | 4.0 | **3.93** | 26.2 | 3.44 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5336 | `66336129bf804500132d8070` | 3.75 | **3.53** | 26.2 | 7.88 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5550 | `68638345339f1b0013a7ed68` | 3.93 | **3.87** | 27.4 | 3.12 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5533 | `68638111fe855700134d6ec1` | 4.23 | **4.24** | 27.7 | 4.7 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5520 | `6825af83e9a8820013155062` | 3.99 | **3.91** | 28.3 | 4.09 | 2025-12-31 | Low Uptime with Good Battery |
| aq_g532 | `60a822eec01cec5f7fa4d1cb` | 4.01 | **3.9** | 28.3 | 17.82 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5490 | `6825a5c7e9a88200131548bf` | 4.01 | **3.93** | 28.6 | 1.71 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5506 | `6825ae41e9a8820013154fcc` | 4.02 | **3.92** | 28.6 | 2.22 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5462 | `67d14601048ca300132529dc` | 4.05 | **3.94** | 28.9 | 57.13 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5527 | `683d4cf0287850001475077e` | 4.04 | **3.91** | 28.9 | 1.97 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5540 | `686382930aef8b001385ce3a` | 4.07 | **3.93** | 28.9 | 3.31 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5529 | `68626af0fe855700134cf3f2` | 4.03 | **3.91** | 29.2 | 2.18 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5543 | `686382dbfe855700134d6efe` | 4.05 | **3.93** | 29.2 | 2.84 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5541 | `686382a30aef8b001385ce42` | 4.03 | **3.89** | 29.2 | 1.02 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5532 | `68626b1bfe855700134cf409` | 4.07 | **3.89** | 29.2 | 1.49 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5429 | `67c9939c71c7b0001383eec4` | 4.02 | **3.97** | 29.2 | 6.28 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5489 | `6825a5b28eb1420013d2b30a` | 3.89 | **3.74** | 29.2 | 1.41 | 2025-12-31 | Low Uptime with Good Battery |
| airqo_g5466 | `67d14684048ca30013252f39` | 3.92 | **3.7** | 30.4 | 4.92 | 2025-12-27 | Low Uptime with Good Battery |
| aq_g5_97 | `6332a879d8a1ef001e01384e` | 4.03 | **4.06** | 31.5 | 1.67 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5389 | `67a31ca2ab975d00158c0796` | 3.76 | **3.6** | 33.0 | 17.69 | 2025-12-27 | Low Uptime with Good Battery |
| aq_g531 | `60a82272c01cec5f7fa4d1ca` | 3.94 | **3.7** | 35.1 | 12.04 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5396 | `67a329948ab7f2001374d538` | 3.91 | **3.53** | 35.7 | 30.06 | 2025-12-27 | Low Uptime with Good Battery |
| aq_g5_53 | `61b73277a1c2cb001ebd56c4` | 3.77 | **3.52** | 35.7 | 15.24 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5332 | `6633603154098f0013dc87a8` | 3.91 | **3.83** | 37.2 | 2.25 | 2025-12-27 | Low Uptime with Good Battery |
| aq_72 | `5f2036bc70223655545a8b80` | 3.95 | **3.84** | 37.2 | 6.88 | 2025-12-27 | Low Uptime with Good Battery |
| aq_g508 | `606d9da5032306001924b98b` | 4.05 | **3.91** | 42.3 | 6.12 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5407 | `67a33643d5fa790013178d90` | 3.89 | **3.74** | 42.9 | 3.68 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5420 | `67a33c3af1b4c800133aff7a` | 3.94 | **3.58** | 44.0 | 2.48 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5415 | `67a33a19e697b8001366015b` | 3.88 | **3.57** | 44.3 | 3.17 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5408 | `67a3367ad5fa790013178da7` | 3.92 | **3.66** | 45.2 | 3.06 | 2025-12-27 | Low Uptime with Good Battery |
| aq_g522 | `60a81fc1c01cec5f7fa4d1c0` | 4.01 | **3.91** | 45.5 | 16.84 | 2025-12-27 | Low Uptime with Good Battery |
| airqo_g5383 | `67a319935d9299001342f651` | 4.02 | **3.75** | 46.1 | 3.54 | 2025-12-27 | Low Uptime with Good Battery |
| aq_g5_62 | `624d3f72bd3af8001ed350f7` | 3.9 | **3.85** | 48.5 | 35.76 | 2025-12-27 | Low Uptime with Good Battery |
| aq_g533 | `60a82335c01cec5f7fa4d1cc` | 4.06 | **3.62** | 49.7 | 2.5 | 2025-12-27 | Low Uptime with Good Battery |

## Component Failure (10 Devices)
| Device Name | ID | Avg Batt (V) | Last Batt (V) | Uptime (%) | Avg Error | Last Seen | Reason |
|---|---|---|---|---|---|---|---|
| aq_29 | `5f2036bc70223655545a8b55` | 3.87 | **3.76** | 84.2 | 34.06 | 2025-12-31 | High Error Margin |
| airqo_g5373 | `66dea6f807cfe400143cf66d` | 3.95 | **3.81** | 82.7 | 28.28 | 2025-12-31 | High Error Margin |
| aq_g5_121 | `637e019b8022ee001e67f2a1` | 4.08 | **3.99** | 70.2 | 22.66 | 2025-12-31 | High Error Margin |
| aq_g510 | `606d9e15032306001924b9b5` | 3.97 | **3.91** | 61.3 | 196.23 | 2025-12-27 | High Error Margin |
| aq_g5_130 | `637e06318022ee001e67f364` | 4.03 | **3.97** | 83.0 | 42.72 | 2025-12-31 | High Error Margin |
| aq_g5_5 | `6284b59e7986d8001e6b4f92` | 3.87 | **3.77** | 61.3 | 69.4 | 2025-12-27 | High Error Margin |
| aq_g534 | `60a8236fc01cec5f7fa4d1cd` | 3.89 | **3.9** | 60.4 | 34.81 | 2025-12-27 | High Error Margin |
| aq_g5_101 | `6332cc9fd8a1ef001e013c55` | 3.96 | **3.85** | 61.3 | 47.37 | 2025-12-27 | High Error Margin |
| airqo_g5461 | `67d145e713e5ea001494f447` | 4.07 | **3.94** | 62.2 | 26.6 | 2025-12-27 | High Error Margin |
| aq_g530 | `60a82219c01cec5f7fa4d1c9` | 4.02 | **3.99** | 57.4 | 25.45 | 2025-12-27 | High Error Margin |

## Dead (354 Devices)
| Device Name | ID | Avg Batt (V) | Last Batt (V) | Uptime (%) | Avg Error | Last Seen | Reason |
|---|---|---|---|---|---|---|---|
| airqo_g5567 | `68638eae0aef8b001385d467` | - | **-** | - | - | - | No data in period |
| airqo_g5563 | `6863872c339f1b0013a7edbc` | - | **-** | - | - | - | No data in period |
| airqo_g5449 | `67d144a3048ca300132528dd` | - | **-** | - | - | - | No data in period |
| nairobi_firestation_bam_logger | `671e450122b67e00141dc567` | - | **-** | - | - | - | No data in period |
| airqo_g5328 | `66beedc028f50500133f0ac9` | - | **-** | - | - | - | No data in period |
| airqo_g5232 | `64935551df2ae7001e5f8695` | - | **-** | - | - | - | No data in period |
| airqo-g5174 | `642537a984fe0b0029f93384` | - | **-** | - | - | - | No data in period |
| aq_g5_81 | `62948f9bdb02e70029158aad` | - | **-** | - | - | - | No data in period |
| aq_60 | `5f2036bc70223655545a8b74` | - | **-** | - | - | - | No data in period |
| airqo_g5481 | `67d147da13e5ea001494f9ce` | - | **-** | - | - | - | No data in period |
| airqo_g5448 | `67d1448800088500130510b2` | - | **-** | - | - | - | No data in period |
| airqo_g5438 | `67d1436d0008850013050fd4` | - | **-** | - | - | - | No data in period |
| airqo_g5430 | `67c993c454d7a90013cbb09b` | - | **-** | - | - | - | No data in period |
| phli_13 | `673ca50faad8c70013bce8d7` | - | **-** | - | - | - | No data in period |
| airqo_g5375 | `66e15e1af3cb4f00133a087c` | - | **-** | - | - | - | No data in period |
| airqo_g5361 | `66de985df8ae3f001317c7b4` | - | **-** | - | - | - | No data in period |
| airqo_g5344 | `6639e88aa620240013617b2f` | - | **-** | - | - | - | No data in period |
| airqo_g5312 | `654c963b839f9e0013a624c3` | - | **-** | - | - | - | No data in period |
| airqo_g5304 | `654b26ebc4e34500135a6195` | - | **-** | - | - | - | No data in period |
| airqo_g5480 | `67d147c313e5ea001494f9c6` | - | **-** | - | - | - | No data in period |
| airqo_g5284 | `654a0225891ebc0013da1328` | - | **-** | - | - | - | No data in period |
| airqo_g5277 | `651ea20a3eea370013cff311` | - | **-** | - | - | - | No data in period |
| airqo_g5274 | `650016b9e1cecb0012ae494d` | - | **-** | - | - | - | No data in period |
| airqo_g5264 | `64ff125c19f3660019609f3b` | - | **-** | - | - | - | No data in period |
| airqo_g5248 | `64ff0d2bf77825001a0956fb` | - | **-** | - | - | - | No data in period |
| airqo_g5215 | `64934649a704ef001e6d3469` | - | **-** | - | - | - | No data in period |
| airqo_g5211 | `64934610adaddd001e6e3570` | - | **-** | - | - | - | No data in period |
| airqo-g5188 | `646e0020f41bc600299f8cf8` | - | **-** | - | - | - | No data in period |
| airqo-g5180 | `646c8c60f41bc600299f4eb3` | - | **-** | - | - | - | No data in period |
| airqo-g5169 | `642536a39ce1610029bc459d` | - | **-** | - | - | - | No data in period |
| airqo-g5159 | `6422a63ac95fc10029aa76a9` | - | **-** | - | - | - | No data in period |
| airqo-g5158 | `6422a5f3eb64a80028f31b39` | - | **-** | - | - | - | No data in period |
| dos-bamako | `640f0ac08c427100296a748f` | - | **-** | - | - | - | No data in period |
| aq_g5_116 | `637e00a08022ee001e67f27f` | - | **-** | - | - | - | No data in period |
| aq_g0_12 | `636f6b4495dc52002992ebce` | - | **-** | - | - | - | No data in period |
| aq_g5_94 | `6331a230cc1b75001e677d60` | - | **-** | - | - | - | No data in period |
| aq_g5_76 | `6284c3969f3197001ea91cdd` | - | **-** | - | - | - | No data in period |
| airqo_g5301 | `654b2654c4e34500135a618b` | - | **-** | - | - | - | No data in period |
| airqo_g5306 | `654b271fc4e34500135a619c` | - | **-** | - | - | - | No data in period |
| airqo_g5273 | `6500132a328d1500135c4b08` | - | **-** | - | - | - | No data in period |
| airqo_g5243 | `649431771cb831001f4fa655` | - | **-** | - | - | - | No data in period |
| airqo_g5241 | `64943158ef70aa001e4f8545` | - | **-** | - | - | - | No data in period |
| airqo_g5230 | `64934742adaddd001e6e35ae` | - | **-** | - | - | - | No data in period |
| airqo_g5225 | `649346e4a704ef001e6d349f` | - | **-** | - | - | - | No data in period |
| airqo-g5168 | `6425368a9ce1610029bc4598` | - | **-** | - | - | - | No data in period |
| airqo-g5163 | `6422a70d9e4cbc001edc4f39` | - | **-** | - | - | - | No data in period |
| airqo-g5156 | `6422a5afc95fc10029aa7672` | - | **-** | - | - | - | No data in period |
| airqo-g5143 | `6422a2dfc95fc10029aa75aa` | - | **-** | - | - | - | No data in period |
| aq_g5_87 | `630c96c52b3753001f35ac61` | - | **-** | - | - | - | No data in period |
| aq_g5_82 | `630c9559e10e5a001e101b57` | - | **-** | - | - | - | No data in period |
| aq_g529 | `60a82194c01cec5f7fa4d1c7` | - | **-** | - | - | - | No data in period |
| aq_43 | `5f2036bc70223655545a8b63` | - | **-** | - | - | - | No data in period |
| aq_27 | `5f2036bc70223655545a8b53` | - | **-** | - | - | - | No data in period |
| airqo_g5202 | `64934584adaddd001e6e355b` | - | **-** | - | - | - | No data in period |
| airqo_g5573 | `686392e1339f1b0013a7f3b4` | - | **-** | - | - | - | No data in period |
| airqo_g5568 | `68638ec00aef8b001385d470` | - | **-** | - | - | - | No data in period |
| phli_14 | `673ca536b0bc9700138f2c04` | - | **-** | - | - | - | No data in period |
| phli_03 | `673ca1d4b0bc9700138f2bd9` | - | **-** | - | - | - | No data in period |
| airqo_g5359 | `66de974407cfe400143cf446` | - | **-** | - | - | - | No data in period |
| airqo_g5307 | `654b2784f5a3b600135fb411` | - | **-** | - | - | - | No data in period |
| airqo-g5194 | `646f3f866c2d5c001e8b0a02` | - | **-** | - | - | - | No data in period |
| airqo-g5145 | `6422a35dc95fc10029aa75cd` | - | **-** | - | - | - | No data in period |
| aq_65 | `5f2036bc70223655545a8b79` | - | **-** | - | - | - | No data in period |
| aq_44 | `5f2036bc70223655545a8b64` | - | **-** | - | - | - | No data in period |
| aq_35 | `5f2036bc70223655545a8b5b` | - | **-** | - | - | - | No data in period |
| aq_39 | `5f2036bc70223655545a8b5f` | - | **-** | - | - | - | No data in period |
| aq_18 | `5f2036bc70223655545a8b4a` | - | **-** | - | - | - | No data in period |
| aq_20 | `5f2036bc70223655545a8b4c` | - | **-** | - | - | - | No data in period |
| airqo_g5548 | `68638317fe855700134d6f1d` | - | **-** | - | - | - | No data in period |
| phli_02 | `673c9fbab0bc9700138f27aa` | - | **-** | - | - | - | No data in period |
| phli_01 | `673c9f1db0bc9700138f275e` | - | **-** | - | - | - | No data in period |
| airqo_g5366 | `66de9e2dc0437500130e7d29` | - | **-** | - | - | - | No data in period |
| airqo_g5365 | `66de9d6007cfe400143cf52d` | - | **-** | - | - | - | No data in period |
| aq_g5_86 | `630c969f2b3753001f35ac5c` | - | **-** | - | - | - | No data in period |
| aq_g512 | `606d9ea5032306001924b9ca` | 3.36 | **3.23** | 4.5 | 15.37 | 2025-12-23 | Last seen 9 days ago |
| aq_66 | `5f2036bc70223655545a8b7a` | - | **-** | - | - | - | No data in period |
| aksls0fp | `603d6ce732e038860ae41907` | - | **-** | - | - | - | No data in period |
| airqo_g5505 | `6825ad7be9a8820013154fa1` | - | **-** | - | - | - | No data in period |
| airqo_g5519 | `6825af78c23a5b00136bff93` | - | **-** | - | - | - | No data in period |
| airqo_g5514 | `6825af04c23a5b00136bff76` | - | **-** | - | - | - | No data in period |
| airqo_g5503 | `6825ad38c23a5b00136bfefc` | - | **-** | - | - | - | No data in period |
| airqo_g5499 | `6825a7c9c23a5b00136bfe70` | - | **-** | - | - | - | No data in period |
| airqo_g5460 | `67d145cf048ca300132529a1` | - | **-** | - | - | - | No data in period |
| airqo_g5347 | `663a0185a620240013618809` | - | **-** | - | - | - | No data in period |
| airqo_g5272 | `64ff16269b6e2f001a9ff6ac` | - | **-** | - | - | - | No data in period |
| airqo_g5196 | `6493450ba2365e001e635968` | - | **-** | - | - | - | No data in period |
| airqo_g5428 | `67c99372a8f1340013c9ae30` | - | **-** | - | - | - | No data in period |
| airqo_g5488 | `6825a599c23a5b00136bf878` | - | **-** | - | - | - | No data in period |
| airqo_g5482 | `67d147eb00088500130516d2` | - | **-** | - | - | - | No data in period |
| airqo_g5474 | `67d1473713e5ea001494f9b3` | - | **-** | - | - | - | No data in period |
| airqo_g5458 | `67d14593000885001305115c` | - | **-** | - | - | - | No data in period |
| airqo_g5457 | `67d1457c000885001305114b` | - | **-** | - | - | - | No data in period |
| airqo_g5443 | `67d1441c0008850013051053` | - | **-** | - | - | - | No data in period |
| airqo_g5437 | `67c9ab7da8f1340013c9bdb5` | - | **-** | - | - | - | No data in period |
| airqo_g5435 | `67c9966854d7a90013cbb783` | - | **-** | - | - | - | No data in period |
| airqo_g5434 | `67c9960071c7b0001383f453` | - | **-** | - | - | - | No data in period |
| airqo_g5427 | `67a346322f92030012dbe3b8` | - | **-** | - | - | - | No data in period |
| airqo_g5271 | `64ff15b69904bc001a385ce8` | - | **-** | - | - | - | No data in period |
| airqo_g5268 | `64ff138532a5b0001adbe232` | - | **-** | - | - | - | No data in period |
| airqo_g5266 | `64ff12ae19f3660019609f4a` | - | **-** | - | - | - | No data in period |
| airqo_g5569 | `68638eed0aef8b001385d47d` | - | **-** | - | - | - | No data in period |
| airqo_g5425 | `67a344fc0138b40013895e22` | - | **-** | - | - | - | No data in period |
| airqo_g5424 | `67a3445fe697b80013660a7c` | - | **-** | - | - | - | No data in period |
| airqo_g5379 | `67a317e2ef75d9001488608c` | - | **-** | - | - | - | No data in period |
| phli_20 | `67a1a89a7b57460013be9a6b` | - | **-** | - | - | - | No data in period |
| phli_19 | `67a1a85105e9810013326aff` | - | **-** | - | - | - | No data in period |
| phli_18 | `67a18735f98036001380e236` | - | **-** | - | - | - | No data in period |
| phli_17 | `67a186fe7b57460013be8408` | - | **-** | - | - | - | No data in period |
| phli_16 | `673ca59aaad8c70013bce8dd` | - | **-** | - | - | - | No data in period |
| phli_15 | `673ca56614a7d80012e1a84c` | - | **-** | - | - | - | No data in period |
| phli_11 | `673ca44414a7d80012e1a843` | - | **-** | - | - | - | No data in period |
| phli_10 | `673ca41fb0bc9700138f2bf5` | - | **-** | - | - | - | No data in period |
| phli_09 | `673ca3efaad8c70013bce8cc` | - | **-** | - | - | - | No data in period |
| phli_08 | `673ca3c2b0bc9700138f2bef` | - | **-** | - | - | - | No data in period |
| phli_07 | `673ca37514a7d80012e1a83d` | - | **-** | - | - | - | No data in period |
| airqo_g5291 | `654a0393f59f69001325bb3f` | - | **-** | - | - | - | No data in period |
| phli_06 | `673ca350aad8c70013bce8c6` | - | **-** | - | - | - | No data in period |
| phli_05 | `673ca235b0bc9700138f2be0` | - | **-** | - | - | - | No data in period |
| airqo_g5345 | `6639e8c3a620240013617b37` | - | **-** | - | - | - | No data in period |
| airqo_g5342 | `6639e7d9a620240013617b19` | - | **-** | - | - | - | No data in period |
| airqo_g5341 | `6639e791a620240013617b0f` | - | **-** | - | - | - | No data in period |
| airqo_g5340 | `6639e753a620240013617af9` | - | **-** | - | - | - | No data in period |
| airqo_g5337 | `6639e678a6202400136179e8` | - | **-** | - | - | - | No data in period |
| arba_minch_nech_sar_square_sp09 | `661e78dadc64ca0013ac5213` | - | **-** | - | - | - | No data in period |
| arba_minch_bus_station_sp_10 | `661d6718253efb00133d3cf7` | - | **-** | - | - | - | No data in period |
| sp_12 | `661d14358ccf140013f7868e` | - | **-** | - | - | - | No data in period |
| airqo_g5313 | `654c965d4af6790012010ac0` | - | **-** | - | - | - | No data in period |
| airqo_g5310 | `654c95f3c391960013ba0961` | - | **-** | - | - | - | No data in period |
| airqo_g5302 | `654b267cf5a3b600135fb38a` | - | **-** | - | - | - | No data in period |
| airqo_g5298 | `654b25ccf5a3b600135fb37e` | - | **-** | - | - | - | No data in period |
| airqo_g5297 | `654b24dec4e34500135a615d` | - | **-** | - | - | - | No data in period |
| airqo_g5294 | `654b247db32754001326df15` | - | **-** | - | - | - | No data in period |
| airqo_g5290 | `654a033c891ebc0013da133b` | - | **-** | - | - | - | No data in period |
| airqo_g5286 | `654a02b0f59f69001325bb2f` | - | **-** | - | - | - | No data in period |
| airqo_g5285 | `654a024f21bac300137ab6e7` | - | **-** | - | - | - | No data in period |
| airqo_g5281 | `6526ae42d2e64a0019c9b64e` | - | **-** | - | - | - | No data in period |
| airqo_g5279 | `6526ae21d2e64a0019c9b63e` | - | **-** | - | - | - | No data in period |
| airqo_g5278 | `651ea29d15cb520013674a19` | - | **-** | - | - | - | No data in period |
| airqo_g5269 | `64ff15472d8b46001ad08faa` | - | **-** | - | - | - | No data in period |
| airqo_g5259 | `64ff1171f77825001a09582b` | - | **-** | - | - | - | No data in period |
| airqo_g5258 | `64ff11322aca1b001a0e3fbf` | - | **-** | - | - | - | No data in period |
| airqo_g5251 | `64ff0dd0f77825001a095702` | - | **-** | - | - | - | No data in period |
| airqo_g5247 | `64d09a04b1bd230012a34cbb` | - | **-** | - | - | - | No data in period |
| airqo_g5237 | `649355c7df2ae7001e5f86b5` | - | **-** | - | - | - | No data in period |
| airqo_g5236 | `649355bcdf2ae7001e5f86af` | - | **-** | - | - | - | No data in period |
| airqo_g5235 | `649355acdf2ae7001e5f86a8` | - | **-** | - | - | - | No data in period |
| airqo_g5229 | `64934717a704ef001e6d34a6` | - | **-** | - | - | - | No data in period |
| airqo_g5228 | `6493470aadaddd001e6e35a5` | - | **-** | - | - | - | No data in period |
| airqo_g5227 | `649346fdadaddd001e6e359e` | - | **-** | - | - | - | No data in period |
| airqo_g5226 | `649346f0adaddd001e6e3598` | - | **-** | - | - | - | No data in period |
| airqo_g5220 | `6493468da704ef001e6d3484` | - | **-** | - | - | - | No data in period |
| airqo_g5216 | `64934659a704ef001e6d3470` | - | **-** | - | - | - | No data in period |
| airqo_g5208 | `649345dcadaddd001e6e3562` | - | **-** | - | - | - | No data in period |
| airqo_g5207 | `649345c3a704ef001e6d3454` | - | **-** | - | - | - | No data in period |
| airqo_g5201 | `64934578adaddd001e6e3555` | - | **-** | - | - | - | No data in period |
| airqo_g5200 | `6493455fa704ef001e6d3443` | - | **-** | - | - | - | No data in period |
| airqo_g5198 | `64934540a2365e001e635980` | - | **-** | - | - | - | No data in period |
| airqo-g5187 | `646dfc72f41bc600299f8c62` | - | **-** | - | - | - | No data in period |
| airqo-g5179 | `646c8c5650dce80029600328` | - | **-** | - | - | - | No data in period |
| airqo-g5178 | `642583973c896300298535a1` | - | **-** | - | - | - | No data in period |
| airqo-g5176 | `642538262c50c7001f7d6509` | - | **-** | - | - | - | No data in period |
| airqo-g5175 | `642537da84fe0b0029f9338d` | - | **-** | - | - | - | No data in period |
| airqo-g5170 | `642536c92c50c7001f7d64eb` | - | **-** | - | - | - | No data in period |
| airqo-g5167 | `6422a77dc95fc10029aa76c0` | - | **-** | - | - | - | No data in period |
| airqo-g5165 | `6422a741c95fc10029aa76ba` | - | **-** | - | - | - | No data in period |
| airqo-g5162 | `6422a6f0c95fc10029aa76af` | - | **-** | - | - | - | No data in period |
| airqo-g5136 | `63e130a23d2d33001e5247a1` | - | **-** | - | - | - | No data in period |
| airqo-g5161 | `6422a6af9e4cbc001edc4f30` | - | **-** | - | - | - | No data in period |
| aq_g5_112 | `637dff917c737c001e799ed0` | - | **-** | - | - | - | No data in period |
| dos-khartoum-re | `63b42402bfe002002b3a3a3a` | - | **-** | - | - | - | No data in period |
| airqo-g5157 | `6422a5d5c95fc10029aa7699` | - | **-** | - | - | - | No data in period |
| airqo-g5155 | `6422a575c95fc10029aa7600` | - | **-** | - | - | - | No data in period |
| airqo-g5149 | `6422a495c95fc10029aa75e4` | - | **-** | - | - | - | No data in period |
| airqo-g5148 | `6422a47a9e4cbc001edc4e8a` | - | **-** | - | - | - | No data in period |
| airqo-g5144 | `6422a3369e4cbc001edc4e68` | - | **-** | - | - | - | No data in period |
| airqo-g5142 | `6422a2b8c95fc10029aa75a5` | - | **-** | - | - | - | No data in period |
| dos-addis-centr | `640f1ae5e8760a0029223700` | - | **-** | - | - | - | No data in period |
| dos-kigali | `640f18539b9c0d001e00a205` | - | **-** | - | - | - | No data in period |
| dos-lagos | `640f0bc89b9c0d001e00a011` | - | **-** | - | - | - | No data in period |
| dos-algiers | `640f0b541663d3001e40bcf7` | - | **-** | - | - | - | No data in period |
| dos-conakry | `640f0a2f9b9c0d001e009ff8` | - | **-** | - | - | - | No data in period |
| airqo-g5139 | `63e20c993d2d33001e5266b4` | - | **-** | - | - | - | No data in period |
| aq_g5_126 | `637e03ba7c737c001e799f5c` | - | **-** | - | - | - | No data in period |
| aq_g5_119 | `637e013b977802001f1ffbbf` | - | **-** | - | - | - | No data in period |
| aq_g5_117 | `637e00c97c737c001e799f08` | - | **-** | - | - | - | No data in period |
| aq_g0_23 | `636f6d66f7b1750029abc3f6` | - | **-** | - | - | - | No data in period |
| aq_g0_22 | `636f6d0c50ac07002ae71719` | - | **-** | - | - | - | No data in period |
| aq_g0_18 | `636f6c5f95dc52002992ebdc` | - | **-** | - | - | - | No data in period |
| aq_g0_17 | `636f6c3ef7b1750029abc3ea` | - | **-** | - | - | - | No data in period |
| airqo_g5512 | `6825aee88eb1420013d2b9eb` | - | **-** | - | - | - | No data in period |
| aq_g0_15 | `636f6bcef7b1750029abc3df` | - | **-** | - | - | - | No data in period |
| aq_g0_13 | `636f6b8595dc52002992ebd5` | - | **-** | - | - | - | No data in period |
| aq_g5_80 | `62948f6e2901650029b269a6` | - | **-** | - | - | - | No data in period |
| aq_g5_79 | `62948f59db02e70029158aa7` | - | **-** | - | - | - | No data in period |
| aq_g5_3 | `6284b5939f3197001ea91ac9` | - | **-** | - | - | - | No data in period |
| aq_g5_49 | `61b7322e72eb920029567e71` | - | **-** | - | - | - | No data in period |
| aq_g5_48 | `61b73214a1c2cb001ebd5658` | - | **-** | - | - | - | No data in period |
| aq_g5_43 | `61960c7139ae8a002ae72d7c` | - | **-** | - | - | - | No data in period |
| aq_g5_42 | `61960c57d9e5ce0029d26089` | - | **-** | - | - | - | No data in period |
| airqo_g5446 | `67d1445c13e5ea001494f37b` | - | **-** | - | - | - | No data in period |
| airqo_g5441 | `67d143dc000885001305102a` | - | **-** | - | - | - | No data in period |
| airqo_g5440 | `67d143c5048ca30013252867` | - | **-** | - | - | - | No data in period |
| airqo_g5426 | `67a3453ce697b80013660a8c` | - | **-** | - | - | - | No data in period |
| aq_g527 | `60a8210dc01cec5f7fa4d1c5` | - | **-** | - | - | - | No data in period |
| aq_g521 | `60a81f2ac01cec5f7fa4d1bf` | - | **-** | - | - | - | No data in period |
| aq_g513 | `60a817fdc01cec5f7fa4d1b7` | 4.14 | **4.21** | 6.0 | 2.95 | 2025-12-24 | Last seen 8 days ago |
| aq_86 | `5f2036bc70223655545a8b8e` | - | **-** | - | - | - | No data in period |
| aq_74 | `5f2036bc70223655545a8b82` | - | **-** | - | - | - | No data in period |
| anq16pzj | `603d6ce732e038860ae4190e` | - | **-** | - | - | - | No data in period |
| phli_12 | `673ca49db0bc9700138f2bfd` | - | **-** | - | - | - | No data in period |
| phli_04 | `673ca20514a7d80012e1a830` | - | **-** | - | - | - | No data in period |
| airqo_bam_data_logger_01 | `673300ab35eb32001217b90c` | - | **-** | - | - | - | No data in period |
| airqo_g5368 | `66de9f7cc0437500130e7d42` | - | **-** | - | - | - | No data in period |
| airqo_g5367 | `66de9eefc0437500130e7d37` | - | **-** | - | - | - | No data in period |
| airqo_g5356 | `66d99632068a5300139ad19e` | - | **-** | - | - | - | No data in period |
| airqo_g5343 | `6639e82da620240013617b25` | - | **-** | - | - | - | No data in period |
| airqo_g5339 | `6639e6daa620240013617abf` | - | **-** | - | - | - | No data in period |
| airqo_g5338 | `6639e6aaa620240013617aae` | - | **-** | - | - | - | No data in period |
| at6njnzr | `603d6ce732e038860ae41915` | - | **-** | - | - | - | No data in period |
| als2lcwy | `603d6ce732e038860ae4190b` | - | **-** | - | - | - | No data in period |
| arbl6hvz | `603d6ce732e038860ae41904` | - | **-** | - | - | - | No data in period |
| apz80rtm | `603d6ce732e038860ae41909` | - | **-** | - | - | - | No data in period |
| arswtw30 | `603d6ce732e038860ae41916` | - | **-** | - | - | - | No data in period |
| ax9rgbn0 | `603d6ce732e038860ae41913` | - | **-** | - | - | - | No data in period |
| aw66ff7v | `603d6ce732e038860ae41908` | - | **-** | - | - | - | No data in period |
| apyzc5j7 | `603d6ce732e038860ae41905` | - | **-** | - | - | - | No data in period |
| ambd741s | `603d6ce732e038860ae41903` | - | **-** | - | - | - | No data in period |
| azb4pfv4 | `603d6ce732e038860ae4190d` | - | **-** | - | - | - | No data in period |
| ajck5l86 | `603d6ce732e038860ae41911` | - | **-** | - | - | - | No data in period |
| aq_58 | `5f2036bc70223655545a8b72` | - | **-** | - | - | - | No data in period |
| airqo_g5329 | `66335fa3a966380013ee2100` | - | **-** | - | - | - | No data in period |
| airqo_g5311 | `654c961bc391960013ba0969` | - | **-** | - | - | - | No data in period |
| airqo_g5308 | `654b279af5a3b600135fb419` | - | **-** | - | - | - | No data in period |
| airqo_g5295 | `654b24acc4e34500135a6155` | - | **-** | - | - | - | No data in period |
| airqo_g5288 | `654a02fb891ebc0013da1332` | - | **-** | - | - | - | No data in period |
| airqo_g5283 | `654a01ff21bac300137ab6de` | - | **-** | - | - | - | No data in period |
| airqo_g5280 | `6526ae2fd2e64a0019c9b646` | - | **-** | - | - | - | No data in period |
| airqo_g5267 | `64ff12d82fb7d9001a91572b` | - | **-** | - | - | - | No data in period |
| airqo_g5256 | `64ff106df77825001a095821` | - | **-** | - | - | - | No data in period |
| airqo_g5252 | `64ff0e1ea03deb001a07355e` | - | **-** | - | - | - | No data in period |
| airqo_g5245 | `649431971cb831001f4fa65b` | - | **-** | - | - | - | No data in period |
| airqo_g5242 | `649431671cb831001f4fa64f` | - | **-** | - | - | - | No data in period |
| airqo_g5234 | `64935581a704ef001e6d3744` | - | **-** | - | - | - | No data in period |
| airqo_g5233 | `64935574df2ae7001e5f86a0` | - | **-** | - | - | - | No data in period |
| airqo_g5206 | `649345b7a2365e001e635998` | - | **-** | - | - | - | No data in period |
| airqo_g5199 | `6493454eadaddd001e6e354e` | - | **-** | - | - | - | No data in period |
| airqo-g5190 | `646f3eb70caf7f001e501be0` | - | **-** | - | - | - | No data in period |
| airqo-g5186 | `646c8d4ef41bc600299f4ed1` | - | **-** | - | - | - | No data in period |
| aq_46 | `5f2036bc70223655545a8b66` | - | **-** | - | - | - | No data in period |
| aq_48 | `5f2036bc70223655545a8b68` | - | **-** | - | - | - | No data in period |
| aq_04 | `5f2036bc70223655545a8b3c` | 3.18 | **3.29** | 2.7 | 2.31 | 2025-12-24 | Last seen 8 days ago |
| airqo-g5164 | `6422a727c95fc10029aa76b5` | - | **-** | - | - | - | No data in period |
| airqo-g5152 | `6422a507c95fc10029aa75f0` | - | **-** | - | - | - | No data in period |
| dos-kinshasa | `640f19339b9c0d001e00a213` | - | **-** | - | - | - | No data in period |
| dos-ndjamena | `640f0c171663d3001e40bd0a` | - | **-** | - | - | - | No data in period |
| dos-abidjan | `640f0b071663d3001e40bcf1` | - | **-** | - | - | - | No data in period |
| us-dos-khartoum | `63b423122b000c002af52266` | - | **-** | - | - | - | No data in period |
| aq_g5_127 | `637e04168022ee001e67f2c6` | - | **-** | - | - | - | No data in period |
| aq_g5_125 | `637e03698022ee001e67f2c1` | - | **-** | - | - | - | No data in period |
| aq_g5_123 | `637e02257c737c001e799f4b` | - | **-** | - | - | - | No data in period |
| aq_g5_122 | `637e01be8022ee001e67f2a7` | - | **-** | - | - | - | No data in period |
| aq_g5_113 | `637e00247c737c001e799edc` | - | **-** | - | - | - | No data in period |
| aq_g0_21 | `636f6ce350ac07002ae71713` | - | **-** | - | - | - | No data in period |
| aq_g0_19 | `636f6c9c95dc52002992ebe1` | - | **-** | - | - | - | No data in period |
| aq_g5_110 | `63454cc09de2780029306905` | - | **-** | - | - | - | No data in period |
| aq_g5_93 | `6331a1abcc1b75001e677d58` | - | **-** | - | - | - | No data in period |
| aq_g5_88 | `630c96fae10e5a001e101b63` | - | **-** | - | - | - | No data in period |
| aq_g5_84 | `630c9629eac0a5001e56db00` | - | **-** | - | - | - | No data in period |
| aq_g5_61 | `624d3f12bd3af8001ed350dd` | - | **-** | - | - | - | No data in period |
| aq_g5_64 | `624d4034994194001ddccf42` | - | **-** | - | - | - | No data in period |
| aq_g5_65 | `624d40afbd3af8001ed35103` | - | **-** | - | - | - | No data in period |
| aq_g5_69 | `624d425dbd3af8001ed35215` | - | **-** | - | - | - | No data in period |
| aq_g5_50 | `61b7324372eb920029567e77` | - | **-** | - | - | - | No data in period |
| aq_g5_44 | `61960c9639ae8a002ae72de0` | - | **-** | - | - | - | No data in period |
| aq_g506 | `606ef94cf5758345349ebd6c` | - | **-** | - | - | - | No data in period |
| ag_588c81267534 | `691f123d58d0960013effb3c` | - | **-** | - | - | - | No data in period |
| airqo_g5570 | `68638eff339f1b0013a7f37e` | - | **-** | - | - | - | No data in period |
| airqo_g5564 | `686387370aef8b001385ceba` | - | **-** | - | - | - | No data in period |
| airqo_g5559 | `686383e10aef8b001385ce87` | - | **-** | - | - | - | No data in period |
| airqo_g5545 | `686382f2fe855700134d6f0e` | - | **-** | - | - | - | No data in period |
| airqo_g5544 | `686382e6fe855700134d6f05` | - | **-** | - | - | - | No data in period |
| aq_g0_2 | `6249cab4c00719a17427c531` | - | **-** | - | - | - | No data in period |
| ay2j2q7z | `603d6ce732e038860ae4190a` | - | **-** | - | - | - | No data in period |
| aqknslbv | `603d6ce732e038860ae4190c` | - | **-** | - | - | - | No data in period |
| ar2rhv97 | `603d6ce732e038860ae41902` | - | **-** | - | - | - | No data in period |
| aq_62 | `5f2036bc70223655545a8b76` | - | **-** | - | - | - | No data in period |
| aq_68 | `5f2036bc70223655545a8b7c` | - | **-** | - | - | - | No data in period |
| anyrc92f | `603d6ce732e038860ae41917` | - | **-** | - | - | - | No data in period |
| aq_54 | `5f2036bc70223655545a8b6e` | - | **-** | - | - | - | No data in period |
| aq_33 | `5f2036bc70223655545a8b59` | - | **-** | - | - | - | No data in period |
| airqo_g5483 | `67d1480200088500130516d9` | - | **-** | - | - | - | No data in period |
| airqo_g5477 | `67d14783048ca30013252f76` | - | **-** | - | - | - | No data in period |
| airqo_g5476 | `67d1476a13e5ea001494f9ba` | - | **-** | - | - | - | No data in period |
| airqo_g5459 | `67d145b6048ca30013252980` | - | **-** | - | - | - | No data in period |
| airqo_g5455 | `67d1453f13e5ea001494f421` | - | **-** | - | - | - | No data in period |
| airqo_g5436 | `67c9ab2071c7b0001383fdb1` | - | **-** | - | - | - | No data in period |
| airqo_g5431 | `67c99464a8f1340013c9aed0` | - | **-** | - | - | - | No data in period |
| phli_21 | `67a1a8c405e9810013326b37` | - | **-** | - | - | - | No data in period |
| airqo_g5346 | `663a014da620240013618800` | - | **-** | - | - | - | No data in period |
| airqo_g5333 | `6633607c54098f0013dc87af` | - | **-** | - | - | - | No data in period |
| dit_vingunguti_05 | `661e9521f8f86300138e413b` | - | **-** | - | - | - | No data in period |
| sp_01 | `6617ea94691c3d0013a31f68` | - | **-** | - | - | - | No data in period |
| airqo_g5303 | `654b26afb32754001326df41` | - | **-** | - | - | - | No data in period |
| airqo_g5300 | `654b2635c4e34500135a617d` | - | **-** | - | - | - | No data in period |
| airqo_g5296 | `654b24c4b32754001326df2f` | - | **-** | - | - | - | No data in period |
| airqo_g5292 | `654a03d8891ebc0013da1357` | - | **-** | - | - | - | No data in period |
| airqo_g5289 | `654a031df59f69001325bb36` | - | **-** | - | - | - | No data in period |
| airqo_g5282 | `6531555053d72d0014659b5d` | - | **-** | - | - | - | No data in period |
| airqo_g5270 | `64ff158c2d8b46001ad08fb5` | - | **-** | - | - | - | No data in period |
| airqo_g5265 | `64ff128a19f3660019609f42` | - | **-** | - | - | - | No data in period |
| airqo_g5263 | `64ff123c19f3660019609f34` | - | **-** | - | - | - | No data in period |
| airqo_g5260 | `64ff1193892281001952317e` | - | **-** | - | - | - | No data in period |
| airqo_g5254 | `64ff0ff8f77825001a095817` | - | **-** | - | - | - | No data in period |
| airqo_g5253 | `64ff0fc38922810019523165` | - | **-** | - | - | - | No data in period |
| airqo_g5249 | `64ff0d66a03deb001a073552` | - | **-** | - | - | - | No data in period |
| airqo_g5240 | `6493561fdf2ae7001e5f86be` | - | **-** | - | - | - | No data in period |
| airqo_g5239 | `64935613a704ef001e6d3751` | - | **-** | - | - | - | No data in period |
| airqo_g5231 | `64935546a704ef001e6d373d` | - | **-** | - | - | - | No data in period |
| airqo_g5217 | `64934669a704ef001e6d3477` | - | **-** | - | - | - | No data in period |
| airqo_g5214 | `6493463cadaddd001e6e3578` | - | **-** | - | - | - | No data in period |
| airqo_g5213 | `6493462da704ef001e6d3463` | - | **-** | - | - | - | No data in period |
| airqo_g5209 | `649345eca2365e001e63599f` | - | **-** | - | - | - | No data in period |
| airqo_g5205 | `649345aca704ef001e6d344c` | - | **-** | - | - | - | No data in period |
| airqo-g5192 | `646f3f2f6c2d5c001e8b09f2` | - | **-** | - | - | - | No data in period |
| airqo-g5191 | `646f3efc0c261f001e8fef48` | - | **-** | - | - | - | No data in period |
| airqo-g5182 | `646c8c6ff41bc600299f4ec0` | - | **-** | - | - | - | No data in period |
| airqo-g5181 | `646c8c6af41bc600299f4eb9` | - | **-** | - | - | - | No data in period |
| airqo-g5177 | `642538bf88d7e4001d35971f` | - | **-** | - | - | - | No data in period |
| airqo-g5172 | `6425372f9ce1610029bc45be` | - | **-** | - | - | - | No data in period |
| airqo-g5166 | `6422a75d9e4cbc001edc4f40` | - | **-** | - | - | - | No data in period |
| airqo-g5153 | `6422a52ac95fc10029aa75f6` | - | **-** | - | - | - | No data in period |
| airqo-g5151 | `6422a4d7c95fc10029aa75eb` | - | **-** | - | - | - | No data in period |
| airqo-g5146 | `6422a43dc95fc10029aa75d6` | - | **-** | - | - | - | No data in period |
| airqo-g5147 | `6422a3d8b6ad210028fcc187` | - | **-** | - | - | - | No data in period |
| airqo-g5140 | `63fe0a0d6864bb001e3b0e0a` | - | **-** | - | - | - | No data in period |
| aq_g5_133 | `638710f82bf2f3001eff15e2` | - | **-** | - | - | - | No data in period |
| aq_g5_124 | `637e02908022ee001e67f2b9` | - | **-** | - | - | - | No data in period |
| aq_g5_120 | `637e0175977802001f1ffbc9` | - | **-** | - | - | - | No data in period |
| aq_g5_118 | `637e00f47c737c001e799f17` | - | **-** | - | - | - | No data in period |
| aq_g5_114 | `637e004e8022ee001e67f278` | - | **-** | - | - | - | No data in period |
| aq_g5_75 | `6284b5b47986d8001e6b4fb3` | - | **-** | - | - | - | No data in period |
| aq_g5_46 | `61960cf5d9e5ce0029d2613e` | - | **-** | - | - | - | No data in period |
| aq_g5_41 | `61960c4839ae8a002ae72d4d` | - | **-** | - | - | - | No data in period |
| aq_g5_39 | `61960c23d9e5ce0029d2605f` | - | **-** | - | - | - | No data in period |
| aq_g5_38 | `61960c0d39ae8a002ae72d46` | - | **-** | - | - | - | No data in period |
| aq_g4_100 | `61238c35cd82da001f4d9283` | - | **-** | - | - | - | No data in period |
| aq_g503 | `606ef7449b7292407e015bf9` | - | **-** | - | - | - | No data in period |
| aq_91 | `5f2036bc70223655545a8b93` | - | **-** | - | - | - | No data in period |
| aq_89 | `5f2036bc70223655545a8b91` | - | **-** | - | - | - | No data in period |
| aq_70 | `5f2036bc70223655545a8b7e` | - | **-** | - | - | - | No data in period |
| aq_59 | `5f2036bc70223655545a8b73` | - | **-** | - | - | - | No data in period |
| aq_53 | `5f2036bc70223655545a8b6d` | - | **-** | - | - | - | No data in period |
| aq_47 | `5f2036bc70223655545a8b67` | - | **-** | - | - | - | No data in period |
| aq_40 | `5f2036bc70223655545a8b60` | - | **-** | - | - | - | No data in period |
