scoreboard objectives add vantage_enabled dummy
scoreboard objectives add vantage_opacity dummy {"displayName": "Opacity (0-100)"}

execute as @a[scores={vantage_enabled=1}] at @s run camera @s set vantage:fpp
execute as @a[scores={vantage_enabled=0}] at @s run camera @s clear
