# Siprakerin Automation Playground

### Lupa kemarin belum absen? welll....

Experimental Node.js application demonstrating Supabase API integration and CRUD operations for the Siprakerin (SMKN 4 Malang) journal management system.

## Overview

This project serves as a learning platform for exploring Supabase REST APIs, authentication flows, and database operations through a modern web interface. Built primarily for educational purposes to understand backend integration patterns and API interaction.

### Key Features

**Web Interface (Recommended)**

- Supabase authentication with email/password
- Journal entry management (create, read, delete)
- Server-side input validation and sanitization
- Duplicate entry prevention by date
- Real-time system logging
- Tailwind CSS-powered responsive UI

**CLI Automation (Optional)**

- Automated journal submissions via cron scheduling
- JWT token management and refresh
- Randomized activity generation
- Configurable scheduling for weekday execution

## Technical Stack

- Runtime: Node.js (v16+)
- Web Framework: Express.js
- Templating: EJS
- Database: Supabase (PostgreSQL) - not from me ofc
- Authentication: Supabase Auth
- Styling: Tailwind CSS
- Automation: node-cron (optional)

## Prerequisites

- Node.js v16 or higher
- npm package manager
- Active Supabase project
- Valid Siprakerin account credentials

## Installation

### 1. Clone Repository

```bash
git https://github.com/Arga-12/siprakerinplayground.git
cd siprakerinplayground
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Environment Configuration

Create environment file from template:

```bash
cp .env.example .env
```

Configure the following variables in `.env`:

```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
EMAIL=your_email@example.com
PASSWORD=your_password_here
```

**Obtaining Supabase credentials:**

1. Navigate to Supabase Dashboard
2. Select your project
3. Go to Settings > API
4. Copy Project URL and anon/public API key

### 4. Build Assets (Optional)

If modifying styles:

```bash
cd ui
npm run build:css
cd ..
```

### 5. Start Application

**Primary Method: Web Interface**

```bash
cd ui/
npm run dev #run the website interface from ui dir
```

Access the interface at `http://localhost:3000`

## Project Structure

```
absensiprakerin/
├── automasi/                 # Automation module coming soon
│   ├── src/
│   │   ├── auth.js          # Authentication handler
│   │   ├── config.js        # Configuration management
│   │   ├── journal.js       # CRUD operations
│   │   └── utils.js         # Utility functions
│   └── index.js             # CLI entry point
├── ui/                       # Web interface
│   ├── views/
│   │   └── index.ejs        # Main template
│   ├── src/
│   │   └── input.css        # Tailwind source
│   ├── public/
│   │   └── output.css       # Compiled styles
│   └── server.js            # Express server
├── .env.example             # Environment template
├── .gitignore
└── README.md
```

## API Operations

### Supported Actions

- **Create**: Submit new journal entries (status: hadir/libur)
- **Read**: Fetch journal history with pagination
- **Delete**: Remove journal entries by ID
- **Validate**: Server-side validation for data integrity

### Validation Rules

- Duplicate date entries are blocked
- Only "hadir" and "libur" status values accepted
- All validation occurs server-side (client manipulation resistant)
- Missing required fields trigger appropriate error responses

## Security Considerations

**Critical:** Never commit `.env` file to version control.

- Implement Row Level Security (RLS) policies in Supabase
- Review and restrict database permissions appropriately
- Use environment-specific configurations
- Rotate credentials before public deployment
- Audit API key permissions regularly

## Troubleshooting

| Issue                     | Resolution                                                     |
| ------------------------- | -------------------------------------------------------------- |
| Missing environment file  | Copy `.env.example` to `.env` and populate values              |
| Authentication failure    | Verify EMAIL and PASSWORD credentials                          |
| Supabase connection error | Confirm SUPABASE_URL and SUPABASE_ANON_KEY                     |
| Port conflict (3000)      | Modify port in `ui/server.js` or terminate conflicting process |
| Styles not applying       | Execute `npm run build:css` in ui/ directory                   |
| Database permission error | Review Supabase RLS policies and table permissions             |

## Development

Built as an educational project to explore:

- Supabase REST API integration patterns
- Server-side validation strategies
- Authentication flow implementation
- CRUD operation design
- Modern web development practices

## Disclaimer

This project is provided for educational and experimental purposes only. It is not intended for production use. The author assumes no responsibility for misuse or any consequences resulting from the use of this software.

## License

Copyright 2026 4rgandull. All rights reserved.

Licensed for personal and educational use only. Redistribution or commercial use requires explicit permission *gelok, iyak iyak punya sendiri*.

## Acknowledgments

- SMKN 4 Malang for the Siprakerin platform
- Supabase for backend infrastructure
- Open source community contributions
- Do whatever u want but black hat >:(
