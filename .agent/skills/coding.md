# Coding Standards

Follow these principles when developing for the ERP App:

## Styling & Infrastructure
- **Radix UI**: Use Radix UI primitives (`@radix-ui/react-*`) for complex interactive components (tooltips, dialogs, etc.).
- **Tailwind CSS**: All styling must be done using Tailwind utility classes.
- **Framer Motion**: Add smooth transitions and entry animations to UI elements where appropriate.
- **Lucide Icons**: Use the `lucide-react` library for consistent iconography.

## React Patterns
- **Server Components**: Prefer Next.js Server Components for data fetching unless client-side interactivity is required.
- **Zod Validation**: Always use Zod (`zod`) for validating form inputs and database responses.
- **Shadcn/UI Consistency**: Follow the styling patterns established in the project (typically found in `src/components/ui`).

## Performance
- **Image Optimization**: Use the `next/image` component for all static and dynamic images.
- **Client Components**: Mark only the necessary parts with `'use client'`.

## AI Integration
- **Context-Aware**: When adding new features, consider if a Genkit flow could simplify the user interaction (e.g., summarizing an invoice, generating a report).
- **Graceful Failure**: Ensure the UI handles AI loading states and potential errors gracefully with clear user feedback.
