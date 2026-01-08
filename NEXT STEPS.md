NEXT STEPS

# Goal
- develop an AI book designer

# Approach
- use Google A2UI or a similar framework, so the Book Designer can safely create pages + book?  https://developers.googleblog.com/introducing-a2ui-an-open-project-for-agent-driven-interfaces/

## Steps
  - User selects a date range in /builder, clicks "Create Book"
  - AI agent reads full list of activities in /builder, proposes initial:  narrative arc; A races to highight; theme / color scheme; (other?)
  - User reviews, accepts
  - AI agent generates book
    - For each key section of book, back-end presents to agent: (a) full set of information / sections avaiable to compose into page or section, including available photos and fonts; (b) a simple starting template; (c) instructions / prompt to guide agent in creating customized page or section
      - For (a), we likely need to pre-generate certain artifacts, e.g., heat maps, split charts, etc., and present to agent as images / components to use in its composition
    - Consider using a higher-end agent (e.g., Opus) for this step. Will need to add an Anthropic API key.  May be a multi-step process, where the agent first creates a narrative arc, then a race section, then a year at a glance, etc.
  - User previews and/or downloads book
  - [Future] User can edit book, add text or photos in key locations, etc

