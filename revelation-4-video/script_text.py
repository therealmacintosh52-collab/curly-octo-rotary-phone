"""Revelation 4:1-11 (TPT) broken into narration beats.

Each beat carries:
  id      - stable key used by the visual timeline
  text    - on-screen text (display punctuation)
  say     - text handed to the TTS (normalised punctuation)
  voice   - delivery treatment: narrator | throne | worship
  gap     - seconds of silence after the line
"""

BEATS = [
    dict(
        id="portal",
        voice="narrator",
        gap=0.85,
        text="Then suddenly, after I wrote down these messages,\nI saw a portal open into the heavenly realm,",
        say="Then suddenly, after I wrote down these messages, I saw a portal open into the heavenly realm,",
    ),
    dict(
        id="trumpet",
        voice="narrator",
        gap=1.5,
        text="and the same trumpet-voice I heard speaking with me\nat the beginning said,",
        say="and the same trumpet voice I heard speaking with me at the beginning said,",
    ),
    dict(
        id="ascend",
        voice="throne",
        gap=2.6,
        text="“Ascend into this realm!\nI want to reveal to you what must happen after this.”",
        say="Ascend into this realm! I want to reveal to you what must happen after this.",
    ),
    dict(
        id="spirit",
        voice="narrator",
        gap=0.8,
        text="Instantly I was taken into the spirit realm, and behold—",
        say="Instantly I was taken into the spirit realm, and behold,",
    ),
    dict(
        id="throne_set",
        voice="narrator",
        gap=1.8,
        text="I saw a heavenly throne being set in place\nand someone seated upon it.",
        say="I saw a heavenly throne being set in place, and someone seated upon it.",
    ),
    dict(
        id="jasper",
        voice="narrator",
        gap=1.4,
        text="His appearance was sparkling like crystal\nand glowing like a carnelian gemstone.",
        say="His appearance was sparkling like crystal, and glowing like a carnelian gemstone.",
    ),
    dict(
        id="emerald",
        voice="narrator",
        gap=1.6,
        text="Surrounding the throne was a circle of green light,\nlike an emerald rainbow.",
        say="Surrounding the throne was a circle of green light, like an emerald rainbow.",
    ),
    dict(
        id="elders",
        voice="narrator",
        gap=1.6,
        text="Encircling the great throne were twenty-four thrones\nwith elders in glistening white garments seated upon them,\neach wearing a golden crown of victory.",
        say="Encircling the great throne were twenty four thrones, with elders in glistening white garments seated upon them, each wearing a golden crown of victory.",
    ),
    dict(
        id="lightning",
        voice="narrator",
        gap=2.0,
        text="And pulsing from the throne were blinding flashes of lightning,\ncrashes of thunder, and voices.",
        say="And pulsing from the throne were blinding flashes of lightning, crashes of thunder, and voices.",
    ),
    dict(
        id="torches",
        voice="narrator",
        gap=1.6,
        text="And burning before the throne were seven blazing torches,\nwhich represent the seven Spirits of God.",
        say="And burning before the throne were seven blazing torches, which represent the seven Spirits of God.",
    ),
    dict(
        id="sea",
        voice="narrator",
        gap=1.7,
        text="And in front of the throne there was pavement\nlike a crystal sea of glass.",
        say="And in front of the throne, there was pavement like a crystal sea of glass.",
    ),
    dict(
        id="creatures",
        voice="narrator",
        gap=1.0,
        text="Around the throne and on each side stood four living creatures,\nfull of eyes in front and behind.",
        say="Around the throne, and on each side, stood four living creatures, full of eyes in front and behind.",
    ),
    dict(
        id="faces",
        voice="narrator",
        gap=1.2,
        text="The first living creature resembled a lion, the second an ox,\nthe third had a human face, and the fourth was like an eagle in flight.",
        say="The first living creature resembled a lion, the second an ox, the third had a human face, and the fourth was like an eagle in flight.",
    ),
    dict(
        id="wings",
        voice="narrator",
        gap=1.4,
        text="Each of the four living creatures had six wings,\nfull of eyes all around and under their wings.",
        say="Each of the four living creatures had six wings, full of eyes all around, and under their wings.",
    ),
    dict(
        id="ceaseless",
        voice="narrator",
        gap=1.3,
        text="They worshiped without ceasing, day and night, singing,",
        say="They worshiped without ceasing, day and night, singing,",
    ),
    dict(
        id="holy",
        voice="worship",
        gap=3.0,
        text="“Holy, holy, holy is the Lord God, the Almighty!\nThe Was, the Is, and the Coming!”",
        say="Holy. Holy. Holy is the Lord God, the Almighty! The Was, the Is, and the Coming!",
    ),
    dict(
        id="glory",
        voice="narrator",
        gap=0.8,
        text="And whenever the living creatures gave glory, honor, and thanks\nto the One who is enthroned and who lives forever and ever,",
        say="And whenever the living creatures gave glory, honor, and thanks to the One who is enthroned, and who lives forever and ever,",
    ),
    dict(
        id="facedown",
        voice="narrator",
        gap=1.3,
        text="the twenty-four elders fell facedown before the one seated on the throne\nand they worshiped the one who lives forever and ever.",
        say="the twenty four elders fell facedown before the one seated on the throne, and they worshiped the one who lives forever and ever.",
    ),
    dict(
        id="crowns",
        voice="narrator",
        gap=1.6,
        text="And they surrendered their crowns before the throne, singing:",
        say="And they surrendered their crowns before the throne, singing:",
    ),
    dict(
        id="worthy",
        voice="worship",
        gap=1.0,
        text="“You are worthy, our Lord and God,\nto receive glory, honor, and power,",
        say="You are worthy, our Lord and God, to receive glory, honor, and power,",
    ),
    dict(
        id="created",
        voice="worship",
        gap=3.4,
        text="for you created all things, and for your pleasure\nthey were created and exist.”",
        say="for you created all things, and for your pleasure they were created, and exist.",
    ),
]

# The flashes of verse 5, as (seconds after the "lightning" line begins,
# power). Picture, thunder and score all read this one list, so the bolt and
# the crack that follows it can never drift apart.
STRIKES = [(0.75, 1.0), (1.55, 0.7), (2.10, 1.15),
           (3.05, 0.6), (4.15, 0.95), (5.20, 0.7)]

# The three swells under "Holy, holy, holy", and the last peal at the end.
HOLY_PULSES = [0.10, 1.70, 3.30]
FINAL_PEAL = 2.40          # seconds after the last line begins

# Seconds of black before the first word, and the held silence after the last.
LEAD_IN = 8.5
TAIL = 13.5
CREDIT = "Revelation 4:1–11  ·  The Passion Translation"
