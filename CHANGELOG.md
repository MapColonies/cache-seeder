# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

## [2.1.0](https://github.com/MapColonies/cache-seeder/compare/v2.0.0...v2.1.0) (2025-07-13)


### Features

* add option to do offset years in refresh_before setting ([#23](https://github.com/MapColonies/cache-seeder/issues/23)) ([34df954](https://github.com/MapColonies/cache-seeder/commit/34df954dadca036faeb125b0a1f600960668413a))

## [2.0.0](https://github.com-personal/MapColonies/cache-seeder/compare/v1.2.5...v2.0.0) (2025-06-22)


### ⚠ BREAKING CHANGES

* add and notify job tracker instead of updating job directly(MAPCO-7208) (#22)

### Features

* add and notify job tracker instead of updating job directly(MAPCO-7208) ([#22](https://github.com-personal/MapColonies/cache-seeder/issues/22)) ([21dd5bc](https://github.com-personal/MapColonies/cache-seeder/commit/21dd5bc3baa4caa8d408dc71eb342b6e9c41e47f))

### [1.2.5](https://github.com/MapColonies/cache-seeder/compare/v1.2.4...v1.2.5) (2025-02-24)


### Bug Fixes

* removing max_old_space_size from Dockerfile ([#21](https://github.com/MapColonies/cache-seeder/issues/21)) ([6dba754](https://github.com/MapColonies/cache-seeder/commit/6dba7545c2f9536a2a3a0cb47d6ff82b95df8b3f))

### [1.2.4](https://github.com/MapColonies/cache-seeder/compare/v1.2.3...v1.2.4) (2024-11-27)


### Bug Fixes

* add numpy ([#19](https://github.com/MapColonies/cache-seeder/issues/19)) ([07eba98](https://github.com/MapColonies/cache-seeder/commit/07eba981714a414642e59d311b8ee43b1aaabe5a))

### [1.2.3](https://github.com/MapColonies/cache-seeder/compare/v1.2.2...v1.2.3) (2024-11-05)

### [1.2.2](https://github.com/MapColonies/cache-seeder/compare/v1.2.1...v1.2.2) (2024-05-06)


### Bug Fixes

* upgrade the git action to support workers CI's ([#16](https://github.com/MapColonies/cache-seeder/issues/16)) ([2ca59fa](https://github.com/MapColonies/cache-seeder/commit/2ca59fa8d50ee63d5d9383393811d1c8545af739))

### [1.2.1](https://github.com/MapColonies/cache-seeder/compare/v1.2.0...v1.2.1) (2024-05-06)

## [1.2.0](https://github.com/MapColonies/cache-seeder/compare/v1.1.0...v1.2.0) (2024-05-01)


### Features

* adding tracing mechanism + replace zx mechanism (MAPCO-3940) ([#13](https://github.com/MapColonies/cache-seeder/issues/13)) ([c87f767](https://github.com/MapColonies/cache-seeder/commit/c87f767446e23906aa1a9557955a2dfc182c1e31))

## [1.1.0](https://github.com/MapColonies/cache-seeder/compare/v1.0.6...v1.1.0) (2024-04-17)


### Features

* add redis tls support ( MAPCO-4162) ([#14](https://github.com/MapColonies/cache-seeder/issues/14)) ([35bfca9](https://github.com/MapColonies/cache-seeder/commit/35bfca903e9ede2e8bd2aa93ba4731e474b723d9))

### [1.0.6](https://github.com/MapColonies/cache-seeder/compare/v1.0.5...v1.0.6) (2024-03-19)


### Bug Fixes

* seedConcurrency value from hard-coded to configuration ([#12](https://github.com/MapColonies/cache-seeder/issues/12)) ([45cc600](https://github.com/MapColonies/cache-seeder/commit/45cc600dfb4e1c4e2b30ba06062a9f3fb8c9d243))

### [1.0.5](https://github.com/MapColonies/cache-seeder/compare/v1.0.4...v1.0.5) (2024-03-14)


### Bug Fixes

* add time factor to refresh seed ([d665581](https://github.com/MapColonies/cache-seeder/commit/d6655817d707825948b0191a9bbd9a8c5ea92b87))
* refresh time for seeder with bumping by factor ([#11](https://github.com/MapColonies/cache-seeder/issues/11)) ([32ac897](https://github.com/MapColonies/cache-seeder/commit/32ac89774b8754e53b5764bc28ab9c44e86abc4d))
* revert ([2cefcc6](https://github.com/MapColonies/cache-seeder/commit/2cefcc664c12ea75f0f97d17561e13d5afd83919))

### [1.0.4](https://github.com/MapColonies/cache-seeder/compare/v1.0.3...v1.0.4) (2024-03-13)


### Bug Fixes

* insert timeout after polling valid job ([#10](https://github.com/MapColonies/cache-seeder/issues/10)) ([ab90233](https://github.com/MapColonies/cache-seeder/commit/ab90233409c5996d5f980101c1db3e49fd6c1c79))

### [1.0.3](https://github.com/MapColonies/cache-seeder/compare/v1.0.2...v1.0.3) (2024-03-10)

### [1.0.2](https://github.com/MapColonies/cache-seeder/compare/v1.0.1...v1.0.2) (2024-03-10)


### Bug Fixes

* adapting helm for umbrella ([#8](https://github.com/MapColonies/cache-seeder/issues/8)) ([edee8c2](https://github.com/MapColonies/cache-seeder/commit/edee8c2fd3882bc493d6c6938ed37e526cd25803))

### [1.0.1](https://github.com/MapColonies/cache-seeder/compare/v1.0.0...v1.0.1) (2024-03-07)

## 1.0.0 (2024-03-07)


### Features

* adding grid validation section - preProcess + in proc ([#5](https://github.com/MapColonies/cache-seeder/issues/5)) ([b5d5240](https://github.com/MapColonies/cache-seeder/commit/b5d5240d4009e8775a026dfb900d33b70c6872f3))
* auth support patch ([#6](https://github.com/MapColonies/cache-seeder/issues/6)) ([e1f736a](https://github.com/MapColonies/cache-seeder/commit/e1f736abb9623134f665bfd15e91745f0e319871))
* cache-seeder 1'st implemenation (MAPCO-3850) ([#1](https://github.com/MapColonies/cache-seeder/issues/1)) ([9a0dbfe](https://github.com/MapColonies/cache-seeder/commit/9a0dbfec7dd3e6674c9225907d15121fc36bf1d2))
* create deployment wrap (MAPCO-3850) ([#2](https://github.com/MapColonies/cache-seeder/issues/2)) ([54a0a8a](https://github.com/MapColonies/cache-seeder/commit/54a0a8a2c9534c8accee40a7aa608b8c52784231))
* validate layers cache type only redis ([#4](https://github.com/MapColonies/cache-seeder/issues/4)) ([ec72400](https://github.com/MapColonies/cache-seeder/commit/ec7240072c12102b6e22be70e53d9c1ab4888b74))


### Bug Fixes

* extend zx logs BI + generating real process errors (MAPCO-3950) ([#3](https://github.com/MapColonies/cache-seeder/issues/3)) ([0e46007](https://github.com/MapColonies/cache-seeder/commit/0e4600747177eadfc89832804f9574ac9981f6f5))
