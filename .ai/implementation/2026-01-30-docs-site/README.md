# Prompt-Loop: Docs Site Implementation

## Goal

Implement the isolated-workers documentation site using Vike, Tailwind CSS, and Pagefind with a dark neon/retro-future aesthetic. Spawn subagents sequentially to complete tasks defined in `CHECKLIST.md`, ensuring each task meets its specification and validation criteria.

## Workflow

1. **Review**: Read `CHECKLIST.md` to see overall progress
2. **Select**: Choose an incomplete task from the checklist
3. **Execute**: Complete the task following the linked specification
4. **Validate**: Run the specified validation criteria
5. **Update**: Mark task as complete in CHECKLIST.md
6. **Repeat**: Move to the next task

## Important Notes

- Follow the dark neon color palette defined in specifications
- Use Tailwind utility classes, avoid custom CSS where possible
- Ensure all examples are auto-generated from `examples/` directory
- Navigation should automatically update when new examples are added
- Test responsiveness throughout development
- Use the chrome devtools mcp to verify rendered layouts, `vike dev` from ./docs-site should be used to run the site locally

## Current Focus

**Next Recommended Task**: 01.1 - Scaffold with Vike CLI

---

## Specification Files

Detailed specifications are in `specifications/`:

- `01-project-setup.md` - Project scaffolding and tooling
- `02-navigation-layout.md` - Navigation system and layout
- `03-page-components.md` - Page templates (landing, examples)
- `04-ui-components.md` - Reusable components (code blocks, search)
- `05-content-integration.md` - Example processing and content pages
- `06-build-deployment.md` - Build process and deployment setup

## Completion Criteria

All tasks in CHECKLIST.md marked complete, and:

- [ ] Site builds without errors (`pnpm nx run docs-site:build`)
- [ ] Dev server starts without errors (`pnpm nx run docs-site:dev`)
- [ ] Pagefind indexing runs successfully
- [ ] Examples display correctly
- [ ] Search is functional
- [ ] Dark neon theme consistent
- [ ] Mobile responsive
