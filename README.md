# Neon Harbor

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/ziyoushibo/neon-harbor/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/ziyoushibo/neon-harbor/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game for make.fun's "Make GTA 6" bounty ($1,666 in USDC). A sun-soaked coastal city to explore on foot and by car, with traffic, police, missions and a story — all of it original: its own city, characters, vehicles, names, art, sounds and music.

## The game

You are a broke driver in Neon Harbor. Mara, a fixer at the garage, has work — four jobs that take you from stealing your first car to outrunning the whole Neon Harbor PD:

1. **First Wheels** — steal a car, get it a fresh coat at Neon Paint.
2. **Harbor Run** — deliver a hot package to Pier 9 in 90 seconds.
3. **Turf War** — take Liberty Plaza back from the Red Jackals.
4. **The Big Getaway** — three stars, the whole PD on you, and one way out.

Free roam after the story: steal cars, dodge the wanted stars, collect cash, and see how long you can stay ahead of the law.

## Systems

- **Driving** — arcade car physics with acceleration, steering, handbrake drifts; steal parked and traffic cars (E to enter, E to step out).
- **Traffic & pedestrians** — cars cruise the road grid and turn at intersections; pedestrians stroll the sidewalks and flee from danger.
- **Wanted level** — five stars for crime; police cruisers chase and ram, foot officers close in and arrest. Lay low and the heat fades.
- **Combat** — punch (F) and a pistol (click to shoot, mouse aim) with ammo pickups.
- **HUD & minimap** — health, cash, wanted stars, speed, live minimap with police and mission markers.
- **Save** — progress (cash, ammo, jobs done) saves in the browser.

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080. No build step, no network — every file the game loads lives under `game/`.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot / drive |
| E | Enter a car, talk to Mara |
| F | Punch |
| Click | Shoot (mouse aim) |
| Space | Handbrake |
| Shift | Sprint |
| P | Pause |
| M | Mute |

---

<sub>Entered on [make.fun](https://make.fun/?ref=6vt704rw&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
