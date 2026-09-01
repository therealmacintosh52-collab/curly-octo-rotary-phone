# Collecting real reviews and load data

The proof section on the site is empty on purpose. This is how you fill it
with material you can stand behind.

## Why not just write them

Invented testimonials violate the FTC's endorsement rule (16 CFR Part 465),
which carries civil penalties per violation and applies to a one-truck
operation the same as it applies to Amazon. That is the boring reason.

The real reason is that this is a referral business. Carriers talk. A quote
attributed to "Marcus T., flatbed, Dallas" that nobody can find is the kind of
thing a prospect screenshots into a Facebook group, and you do not recover from
that. The page currently says out loud that you would rather show nothing than
show fiction. That line only works if it is true.

## The ask (send this after a carrier's second or third good week)

Timing matters more than wording. Ask right after something concrete went
right — a good rate you fought for, a detention cheque that landed, a broker
you caught before they burned them.

**Text:**

> Hey [name] — glad that [specific thing] worked out. Quick favour: I'm putting
> a few carrier comments on the site and I'd rather have real ones than the
> made-up kind everybody else runs. Two questions if you've got a minute:
>
> 1. What were you grossing a week before you called me, and what are you
>    grossing now?
> 2. What's the one thing you'd tell another new authority about working
>    with me?
>
> Whatever you send, I'll quote word for word — and I'll show you exactly how
> it'll appear before it goes up. Fine to say no.

That's it. Don't offer a discount for it: paid or incentivised endorsements
have to be disclosed as such, which makes the quote worth less than not having
one.

## What makes a quote worth publishing

Ranked by how much work they do:

1. **A growth number.** "Went from one truck to three in fourteen months."
   Beats everything else on the page.
2. **A specific save.** "Caught a broker at 62 days-to-pay before I loaded."
   Concrete, checkable-sounding, and it proves the bond-verification claim.
3. **A switching story.** Came off a percentage dispatcher and can say what the
   change was worth per month. This one sells the whole flat-rate argument.
4. **General praise.** "Great communication." Nearly worthless — everyone has
   these. Publish it only to pad, and honestly, don't pad.

Always capture: name (or first name + last initial if they prefer), equipment,
how old their authority was when they started with you, and their city and
state. The metadata is what makes a quote read as real.

## Permission

Get it in writing, keep the message. A text saying "yeah go ahead" is fine.
Ask again if you later want to shorten the quote — trimming someone's words so
the meaning shifts is the thing that gets treated as a deceptive endorsement,
not the quoting itself.

## Putting them on the page

In `index.html`, find the `PROOF SECTION` comment. Delete the `.honest` block,
uncomment the `.quotes` block, and add one `<article>` per carrier:

```html
<article class="q rv"><div class="stars" aria-label="5 out of 5">★★★★★</div>
  <blockquote>Their exact words.</blockquote>
  <p class="who"><b>Dave R.</b>Reefer · Authority 4 months · Fresno, CA</p></article>
```

Only use the five stars if they actually rated you five. If you never asked for
a rating, delete the `<div class="stars">` line — implying a rating nobody gave
is the same offence as inventing the quote.

## The load board

Same section, `.loads` table. Delete the `.promise` block, uncomment the table,
one `<tr>` per load, newest first:

```html
<tr><td>Sacramento, CA → Phoenix, AZ</td><td>Dry Van</td><td>755</td>
    <td>$1,890</td><td class="rpm">$2.50</td><td>Mar 4</td></tr>
```

Two rules, because the page commits to both in writing:

- **Post the bad weeks too.** The section says "everything we booked that week,
  including the ugly ones." A board showing nothing under $2.40 a mile reads as
  curated, and carriers know what the market pays. The soft weeks are what make
  the good ones believable.
- **Keep it current.** A board whose newest row is six weeks old is worse than
  no board. If you cannot update weekly, put up a month at a time and label it
  by month instead.

You do not need broker permission to publish your own linehaul and mileage.
Don't name the broker.

## Fastest path from here

Ten to fifteen delivered loads is enough for a real board. Three carriers past
their second week is enough for the quotes. Realistically that is four to six
weeks out — so ship the page as it stands now, and come back to this file then.
