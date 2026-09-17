# Siprakerin playground

Okay so this started as me messing around with Supabase and fetching stuff with **JavaScript** `hehe`. Essentially it logs in with my own credentials, grabs a bearer token, and uses that to fetch + send attendance data straight to the **Siprakerin** Supabase project.

What it can do right now:

- Submits attendance with the statuses `hadir` (present), `izin` (permission), and `libur` (holiday). Oh and you can pick **any date you want**, not just today.
- **Izin with a photo**: uploads the permission letter straight to Supabase Storage (bucket `izin`), just like the real siprakerin.com flow.
- **Extended permission**: if yesterday (H-1) you already filled it as `izin`, the system detects that and automatically reuses the previous day's permission letter photo. So no need to upload the same letter over and over when you're off for a few days in a row. You can still swap it with a fresh file if you want.
- **Auto-fill missing absences**: pulls the official alpha dates from the central server (via the `calculate_alpha_dates_for_student` RPC) and fills each one with a `hadir` entry automatically. One click, done.
- **Mini calendar + stats**: shows every day of the month color-coded by status — present, permission, alpha, holiday, national holiday. You can hop between months and see the count for each status. Click a day and it auto-fills the date field on the form. Handy.
- **Journal history**: full table view of every entry you've made, with pagination and the ability to delete entries.
- **Live system logs**: a running feed of everything the server's doing while you play with it — fetches, submits, errors, the whole thing — rendered right in the browser.

> **Note — how the date thing works:** the only "trick" here is that I skip the rule that locks you to today's date, and I set the `keterangan` + `kegiatan` values myself. If you sniff the request the real platform sends, it looks pretty much like this:
>
> ```js
> const payload = {
>   id_siswa: studentIds.id_siswa,
>   tanggal: journalDate,
>   kegiatan: activity,
>   keterangan: keterangan,
>   id_industri: studentIds.id_industri,
>   id_kelas: studentIds.id_kelas
> };
> ```
>
> Funny part is Siprakerin doesn't actually validate the date server-side — Supabase just accepts whatever you send. So `thanks, I guess :')`

## Wanna use it?

> Fair warning: if you fork it and tweak things for yourself and something breaks, that's on you. I'm NOT liable. 🫩

### 1. Clone & install

```bash
git clone https://github.com/Arga-12/siprakerinplayground.git
cd siprakerinplayground

npm install
```

### 2. Set up credentials (`.env`)

Create a `.env` file in the **root folder** (right next to the `ui` folder), then fill it with your own credentials:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here
USER_EMAIL=your_email@example.com
USER_PASSWORD=your_password_here
```

There's an `.env.example` you can copy and edit.
Supabase URL u're looking for, it is in my Grafikarsa profile.

Optional extras you can add if you already know your IDs:

```env
ID_SISWA=your_student_uuid
ID_KELAS=your_class_id
ID_INDUSTRI=your_industry_id
```

### 3. Build Tailwind CSS first

Yeah, you have to do this before the first run, otherwise the page looks like garbage.

```bash
npm run build:css
```

That's it. Enjoy.

---

## Running the app

#### Dev mode (recommended)

This watches your CSS and rebuilds it whenever you touch `input.css`:

```bash
npm run watch:css
```

Then in a *separate terminal*, boot the server:

```bash
npm run dev
```

#### Production mode

No styling changes? Just run the server:

```bash
npm run dev
```

> Heads up: `.env` must live in the **root folder** (outside of `ui`).

---

## Restarting the server

> If you changed anything in `input.css`, run `npm run build:css` (or `watch:css`) before refreshing the browser, otherwise your changes won't show up.

---

## Updating the tool

Grab the latest stuff:

```bash
git pull
```

If the structure changed a lot (folders got renamed/removed, files moved around), a plain `git pull` might leave leftovers behind. Your machine can end up matching the newest push 100% with:

```bash
git fetch origin main
git checkout main
git reset --hard origin/main
git clean -fd
```

> Heads up: that force-matches your whole folder to the latest push and deletes any local files that aren't in the repo anymore. If you've got uncommitted changes you care about, commit them first.

## Available scripts

All of these run inside `/ui`:

| Script              | What it does                                           |
| ------------------- | ----------------------------------------------------- |
| `npm run dev`       | Dev server with nodemon (auto-restart on changes)     |
| `npm run start`     | Production server                                     |
| `npm run build:css` | One-time Tailwind CSS build                           |
| `npm run watch:css` | Auto-rebuild CSS on changes (for development)         |

Alright, go fill in those past journals if you missed any. And please — no lying about your attendance, okay :3