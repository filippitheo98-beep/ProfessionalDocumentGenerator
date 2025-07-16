# DUERP Generator - Professional Risk Assessment Application

## Overview

This is a modern full-stack web application called "Générateur de DUERP" (Document Unique d'Évaluation des Risques Professionnels) - a Professional Risk Assessment Document Generator. The application allows users to create comprehensive workplace risk assessments by entering company information, managing multiple locations and work units, and generating AI-powered risk analysis tables.

## User Preferences

Preferred communication style: Simple, everyday language.

## Recent Changes

- **2025-07-12**: Major UI/UX overhaul with modern design system and animations
- **2025-07-12**: Implemented dark/light theme toggle with system preference detection
- **2025-07-12**: Added comprehensive header with navigation, notifications, and user menu
- **2025-07-12**: Created smart statistics cards with risk analysis and progress tracking
- **2025-07-12**: Implemented auto-save functionality with visual indicators
- **2025-07-12**: Added intelligent suggestions system based on detected risks
- **2025-07-12**: Integrated photo analysis feature for AI-powered risk detection
- **2025-07-12**: Created version history system for document tracking
- **2025-07-12**: Added tabbed interface for better organization (Creation, Analysis, Suggestions, History)
- **2025-07-12**: Enhanced animations and transitions throughout the application
- **2025-07-12**: Implemented notification system with toast messages
- **2025-07-12**: Added Excel export functionality (PDF temporarily disabled)
- **2025-07-12**: Created responsive design with mobile-first approach
- **2025-07-12**: Restructured DUERP creation workflow - integrated locations and work stations directly into company form
- **2025-07-12**: Replaced individual risk generation with consolidated final risk table generation
- **2025-07-12**: Simplified user interface - single form for complete company setup instead of step-by-step process
- **2025-07-12**: Enhanced CompanyForm component to manage locations and work stations inline
- **2025-07-12**: Implemented batch risk generation for all locations and work stations at once
- **2025-07-12**: Fixed database connection issues and application startup problems
- **2025-07-12**: Added existing prevention measures management to company form
- **2025-07-12**: Fixed database schema to include existing_prevention_measures column
- **2025-07-12**: Enhanced company creation with prevention measures tracking
- **2025-07-12**: Fixed authentication issues preventing company creation
- **2025-07-12**: Implemented simplified tree-structure interface for locations and work units
- **2025-07-12**: Corrected apiRequest function to use modern fetch API standards
- **2025-07-12**: Removed authentication temporarily from company and risk generation endpoints for testing
- **2025-07-12**: Enhanced PhotoAnalysis component to support multiple photo uploads with captions and location descriptions
- **2025-07-12**: Added complete navigation system with Documents, Collaborators, and Reports pages
- **2025-07-12**: Implemented mock APIs for all new pages to ensure full functionality
- **2025-07-13**: Fixed database schema issues preventing archive functionality from working properly
- **2025-07-13**: Removed obsolete columns (is_archived, archived_at) from database schema
- **2025-07-13**: Implemented functional archive/unarchive system with proper document lifecycle management
- **2025-07-13**: Fixed "View" and "Edit" buttons in Documents page to function correctly
- **2025-07-13**: Added view mode for documents with read-only interface and proper data loading
- **2025-07-13**: Enhanced document editing mode to load existing document data correctly
- **2025-07-13**: Created seamless document viewing and editing workflow with proper UI adaptations
- **2025-07-13**: Major restructure: Created new step-by-step DUERP generator with 4 distinct phases
- **2025-07-13**: Added comprehensive company information form with all required fields (name, address, sector, employees, phone, email)
- **2025-07-13**: Implemented locations and workstations management with photo upload and analysis capability
- **2025-07-13**: Created advanced risk generation step with progress tracking and export functionality
- **2025-07-13**: Added analytics dashboard with charts and visual risk analysis
- **2025-07-13**: Implemented stepper component for navigation between phases with completion tracking
- **2025-07-13**: Added auto-save functionality throughout the workflow with manual save option
- **2025-07-13**: Enhanced database schema to support additional company fields (phone, email, employeeCount)
- **2025-07-13**: Fixed archive document viewing functionality to properly load and display archived documents
- **2025-07-13**: Implemented comprehensive PDF export functionality with complete company information, risk statistics, and formatted risk tables
- **2025-07-13**: Added PDF export button to risk generation step with enhanced report including company details, risk distribution summary, and professional formatting
- **2025-07-13**: Integrated charts capture and inclusion in PDF reports using html2canvas
- **2025-07-13**: Fixed PDF table formatting issues with optimized column widths and improved text wrapping
- **2025-07-13**: Resolved request size limit issues for chart image transmission (increased to 50MB limit)
- **2025-07-13**: Enhanced PDF export with progress indicators and better error handling
- **2025-07-13**: Implemented comprehensive revision tracking system with automated notifications
- **2025-07-13**: Added database fields for revision dates and notification status
- **2025-07-13**: Created RevisionNotifications component with smart notification system
- **2025-07-13**: Integrated 30-day advance notifications for 1-year revision cycles
- **2025-07-13**: Added dedicated Revisions page with legal compliance information
- **2025-07-13**: Updated header navigation with revision notifications display
- **2025-07-13**: Created selective update system for existing DUERP documents
- **2025-07-13**: Added updateDuerpDocumentPartial function for incremental document updates
- **2025-07-13**: Implemented SelectiveUpdateModal component for choosing specific modifications
- **2025-07-13**: Added API endpoints for partial document updates (add/remove/update risks)
- **2025-07-13**: Created DocumentTitleInput component with uniqueness validation
- **2025-07-13**: Enhanced error handling for duplicate document names with auto-generation of alternatives

## System Architecture

### Frontend Architecture
- **Framework**: React 18+ with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **UI Framework**: Shadcn/UI components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS custom properties for theming
- **State Management**: React Query (@tanstack/react-query) for server state
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express.js
- **Language**: TypeScript with ESM modules
- **Database**: PostgreSQL with Drizzle ORM
- **Database Provider**: Neon Database (@neondatabase/serverless)
- **Schema Management**: Drizzle Kit for migrations
- **Session Storage**: PostgreSQL-based sessions (connect-pg-simple)

### Development Architecture
- **Monorepo Structure**: Shared types and schemas between client/server
- **Hot Reloading**: Vite dev server integration with Express
- **Type Safety**: Full TypeScript coverage across all layers

## Key Components

### Data Models
1. **Company**: Core entity with name, activity, and locations
2. **Location**: Workplace locations containing work units
3. **WorkUnit**: Specific work areas with associated risks
4. **Risk**: Professional risk assessments with severity ratings
5. **PreventionMeasure**: Safety measures and protective equipment

### Core Features
1. **Company Management**: Create and update company information
2. **Location Management**: Add/remove workplace locations dynamically
3. **Work Unit Management**: Manage specific work areas within locations
4. **Risk Generation**: AI-powered risk assessment based on work unit type
5. **Prevention Measures**: Add custom safety measures and protections
6. **Smart Suggestions**: AI-powered recommendations based on detected risks
7. **Photo Analysis**: Multi-photo upload with captions, location descriptions, and AI-powered risk detection
8. **Version History**: Track and restore previous document versions
9. **Multi-theme Support**: Dark/light mode with system preference detection
10. **Selective Updates**: Incremental document updates without full regeneration
11. **Document Title Validation**: Uniqueness checks with automatic alternative generation
12. **Revision Tracking**: 1-year cycle notifications with 30-day advance warnings

### UI Components
- **CompanyForm**: Company information input with validation
- **LocationSection**: Collapsible location management interface
- **RiskTable**: Professional risk assessment display with color coding
- **PreventionSection**: Safety measures management interface
- **Header**: Navigation with notifications, theme toggle, and user menu
- **StatsCards**: Dynamic statistics and risk analysis dashboard
- **SmartSuggestions**: AI-powered prevention measure recommendations
- **PhotoAnalysis**: Upload and analyze workplace photos for risk detection
- **VersionHistory**: Document version tracking and restoration
- **ThemeProvider**: Dark/light theme management
- **SelectiveUpdateModal**: Choose specific document modifications
- **DocumentTitleInput**: Title validation with uniqueness checking
- **SelectiveUpdateButton**: Smart update options for existing documents
- **RevisionNotifications**: Automated revision cycle management

## Data Flow

### Client-Server Communication
1. **Company Creation**: POST /api/companies with form data
2. **Company Updates**: PUT /api/companies/:id with location/workunit changes
3. **Risk Generation**: POST /api/generate-risks for AI-powered risk assessment
4. **Real-time Updates**: Optimistic updates with React Query cache management

### Data Storage Strategy
- **In-Memory Storage**: Development mode uses MemStorage for rapid prototyping
- **PostgreSQL**: Production database with JSON fields for nested data
- **Schema Evolution**: Drizzle migrations for database schema changes

### Risk Assessment Algorithm
- **Context-Aware Generation**: Considers work unit type, location, and company activity
- **Severity Calculation**: Gravity × Frequency × Control = Final Risk Level
- **Industry-Specific Risks**: Tailored risk database for different work environments

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database connection
- **drizzle-orm**: Type-safe database operations
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight routing solution
- **react-hook-form**: Form state management
- **zod**: Schema validation and type inference

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives
- **tailwindcss**: Utility-first CSS framework
- **lucide-react**: Modern icon library
- **class-variance-authority**: Type-safe CSS class variants

### Development Dependencies
- **vite**: Fast build tool and dev server
- **typescript**: Type checking and compilation
- **eslint**: Code linting and formatting
- **drizzle-kit**: Database schema management

## Deployment Strategy

### Build Process
1. **Client Build**: Vite builds React app to `dist/public`
2. **Server Build**: ESBuild bundles Express server to `dist/index.js`
3. **Asset Optimization**: Vite handles code splitting and optimization

### Environment Configuration
- **Development**: Hot reloading with tsx and Vite dev server
- **Production**: Compiled JavaScript with NODE_ENV=production
- **Database**: Environment-based DATABASE_URL configuration

### Hosting Requirements
- **Node.js**: Runtime environment for Express server
- **PostgreSQL**: Database service (Neon Database recommended)
- **Static Assets**: Served directly by Express in production

### Key Scripts
- `npm run dev`: Development server with hot reloading
- `npm run build`: Production build for client and server
- `npm run start`: Production server startup
- `npm run db:push`: Database schema synchronization

The application follows modern full-stack patterns with strong type safety, scalable architecture, and professional UI/UX design suitable for workplace risk assessment workflows.