scoreboard objectives add vantage_on dummy

execute as @a[scores={vantage_on=1}] at @s run camera @s set vantage:fpp
execute as @a[scores={vantage_on=0}] at @s run camera @s clear
