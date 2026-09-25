# Review request kit

Review link (opens the Google listing; replace with the short "Get more reviews" link
from Google Business Profile once you have it, it goes straight to the write-a-review
box): https://www.google.com/maps/search/?api=1&query=Phil%27s+Auto+and+Fleet+Repair+Lodi+CA

The QR code in `review-qr.svg` points at that link. Regenerate it when you swap in the
short link (`python3 -c "import segno; segno.make('<link>', error='m').save('marketing/review-qr.svg', scale=8)"`).

Rules: ask everyone, ask the same day, ask for specifics, never offer anything for a review.

## Text message (send from the shop phone at pickup or that evening)

```
Hi [Name], thanks for bringing the [vehicle] in today. If everything's running right, a quick Google review would help us a lot. It takes a minute: [link]
Phil's Auto and Fleet Repair
```

If they mention what was fixed it helps other drivers find us. Say so only in person, not in the text.

## Email (day after pickup)

```
Subject: How's the [vehicle] running?

Hi [Name],

Thanks for trusting us with the [vehicle] [yesterday / this week]. If it's doing what it should, would you take a minute to leave us a Google review? A line about what we fixed helps the next person with the same problem find us.

[link]

If anything isn't right, reply to this email or call (209) 647-4953 and we'll sort it.

[Name]
Phil's Auto and Fleet Repair · 103 E Elm St, Lodi, CA 95240
```

## Invoice footer (one line)

```
Happy with the work? Scan the code or visit [short link] to leave us a Google review. Not happy? Call (209) 647-4953 first and we'll make it right.
```

## Counter card (5 x 7, next to the card reader)

```
   [QR]

   Was the work honest and done right?
   Tell other Lodi drivers.

   Scan to leave a Google review.
   Mention your vehicle and what we fixed.

   Phil's Auto and Fleet Repair
   (209) 647-4953
```

## Replying to reviews

Reply within 48 hours. Name the vehicle and the job if the reviewer did. Three patterns:

- **Positive:** "Thanks, [Name]. Glad the [F-250 / X3] is running right after the [injector / brake] work. See you at the next service."
- **Mixed:** "Thanks for the honest note, [Name]. You're right that the [wait / estimate] should have been clearer. Call me at (209) 647-4953 and I'll go over it with you."
- **Negative:** one calm reply, no argument, take it offline: "I'm sorry the visit went that way, [Name]. I'd like to hear what happened directly. Please call (209) 647-4953 and ask for [Name]." Never mention the invoice amount or the customer's history in public.

## Spanish versions

Text: "Hola [Nombre], gracias por traer su [vehículo] hoy. Si todo anda bien, una reseña rápida en Google nos ayuda mucho: [link]. Phil's Auto and Fleet Repair"

Counter card line: "¿Trabajo honesto y bien hecho? Escanee el código y déjenos una reseña en Google."
