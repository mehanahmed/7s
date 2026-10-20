import React from 'react';
import { ProjectsKanbanClient } from '@/components/projects/ProjectsKanbanClient2';

export default function ProjectsPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-theme(spacing.24))]">
      {/* 
        The ProjectsKanbanClient is a Client Component that handles its own data fetching 
        and state management. The page itself is a Server Component for better performance.
      */}
      <ProjectsKanbanClient />
    </div>
  );
}
