# Save Briefings as JSON with copied Item links

A Briefing is saved as one row whose sections and points are a JSON column, with each linked Item's id, title and Source copied in, rather than as normalised `briefing_points` and `briefing_point_items` tables joined to `items`. Briefings are kept until the owner deletes them, but Items are deleted after 90 days, so a join would leave old Briefings with links that show nothing; the copy keeps them readable, and a Briefing is only ever read whole.

**Trade-offs:** points can't be queried in SQL (such as "every Briefing that cited Item 42"), and a later change to the JSON shape needs code that reads the old shape too.
