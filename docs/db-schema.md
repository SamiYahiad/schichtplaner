# Database Schema — Schichtplaner

Full entity-relationship diagram of all 23 Prisma models.

```mermaid
erDiagram
    User ||--o{ OrganizationMember : "memberships"
    User ||--o{ Booking : "booked"
    User ||--o{ TimeRecord : "tracks"
    User ||--o{ Absence : "requests"
    User ||--o{ Message : "sends"
    User ||--o{ MessageRecipient : "receives"
    User ||--o{ ModRequest : "submits"
    User ||--o{ LiveLog : "logs"
    User ||--o{ TopicPost : "writes"
    User ||--o{ PortalFile : "uploads"
    User ||--o{ EmployeeNote : "subject of"
    User ||--o{ EmployeeNote : "authored"

    Organization ||--o{ OrganizationMember : "has"
    Organization ||--o{ Branch : "has"
    Organization ||--o{ Division : "has"
    Organization ||--o{ Schedule : "has"
    Organization ||--o{ TimeCategory : "has"
    Organization ||--o{ AbsenceCategory : "has"
    Organization ||--o{ Message : "has"
    Organization ||--o{ PortalFolder : "has"
    Organization ||--o{ PortalFile : "has"
    Organization ||--o{ Topic : "has"
    Organization ||--o{ Holiday : "has"
    Organization ||--|| OrgSettings : "has"
    Organization ||--o| TimeSettings : "has"

    OrganizationMember }o--|| Organization : "belongs to"
    OrganizationMember }o--|| User : "belongs to"

    Branch }o--|| Organization : "belongs to"
    Branch ||--o{ Schedule : "has"

    Division }o--|| Organization : "belongs to"
    Division ||--o{ DivisionMember : "has"
    Division ||--o{ Shift : "has"

    Schedule }o--|| Organization : "belongs to"
    Schedule }o--o| Branch : "optional"
    Schedule ||--o{ Shift : "has"
    Schedule ||--o{ Briefing : "has"
    Schedule ||--o| LiveSession : "has"

    Shift }o--|| Schedule : "belongs to"
    Shift }o--o| Division : "optional"
    Shift ||--o{ Booking : "has"
    Shift ||--o{ ModRequest : "has"

    LiveSession ||--o{ LiveDay : "has"
    LiveSession ||--o{ LiveLog : "has"

    TimeRecord }o--o| TimeCategory : "optional"
    Absence }o--|| AbsenceCategory : "has"

    Message }o--o| Message : "reply to"
    Message ||--o{ MessageRecipient : "has"

    PortalFolder }o--o| PortalFolder : "subfolder of"
    PortalFolder ||--o{ PortalFile : "contains"

    Topic ||--o{ TopicPost : "has"

    User {
        string id PK
        string email UK
        string passwordHash
        string firstName
        string lastName
        string nickname
        string phone
        string profileImage
        string locale
        datetime createdAt
    }

    Organization {
        string id PK
        string name
        string address
        enum nameFormat
        enum scheduleVisibility
        datetime createdAt
        datetime deletedAt
    }

    OrganizationMember {
        string id PK
        string organizationId FK
        string userId FK
        enum role
        boolean isActive
        boolean isActivated
        float targetHoursPerWeek
        string activationToken UK
    }

    Branch {
        string id PK
        string organizationId FK
        string name
        string address
    }

    Division {
        string id PK
        string organizationId FK
        string title
        string description
        string color
        boolean isSystem
        datetime deletedAt
    }

    Schedule {
        string id PK
        string organizationId FK
        string branchId FK
        int weekNumber
        int year
        boolean isPublic
        enum settingsLayout
    }

    Shift {
        string id PK
        string scheduleId FK
        string divisionId FK
        int dayOfWeek
        string shiftFrom
        string shiftTo
        int maxEmployees
        enum pauseOption
        int pauseValue
    }

    Booking {
        string id PK
        string shiftId FK
        string userId FK
        datetime bookedAt
        string bookedBy
    }

    ModRequest {
        string id PK
        string shiftId FK
        string userId FK
        enum state
        string note
        datetime deadline
    }

    Briefing {
        string id PK
        string scheduleId FK
        string text
        datetime createdAt
    }

    LiveSession {
        string id PK
        string scheduleId FK_UK
        boolean isActive
        datetime deadline
        boolean autoStop
        boolean allowExceeds
        boolean bookRequests
    }

    LiveDay {
        string id PK
        string liveSessionId FK
        int dayOfWeek
        boolean enabled
    }

    LiveLog {
        string id PK
        string liveSessionId FK
        string shiftId
        string userId FK
        enum action
        datetime loggedAt
    }

    TimeRecord {
        string id PK
        string userId FK
        date date
        string timeFrom
        string timeTo
        int durationHours
        int durationMinutes
        enum type
        string categoryId FK
        string comment
    }

    TimeCategory {
        string id PK
        string organizationId FK
        string name
        boolean enabled
    }

    TimeSettings {
        string id PK
        string organizationId FK_UK
        string trackingOptions
        boolean watchAutoStop
        boolean warningsEnabled
        int warningsMaxHours
        enum whoCanUse
        boolean useCategories
    }

    Absence {
        string id PK
        string userId FK
        string categoryId FK
        date dateFrom
        date dateTo
        string note
        enum status
    }

    AbsenceCategory {
        string id PK
        string organizationId FK
        string name
        string color
        boolean isPaid
    }

    Holiday {
        string id PK
        string organizationId FK
        string name
        date date
        string country
        string state
    }

    Message {
        string id PK
        string organizationId FK
        string senderId FK
        string subject
        string body
        string parentId FK
    }

    MessageRecipient {
        string messageId PK_FK
        string userId PK_FK
        boolean isRead
        boolean isDeleted
    }

    PortalFolder {
        string id PK
        string organizationId FK
        string parentId FK
        string name
    }

    PortalFile {
        string id PK
        string organizationId FK
        string folderId FK
        string name
        string path
        int size
        string mimeType
        string uploadedById FK
    }

    Topic {
        string id PK
        string organizationId FK
        string title
        string createdById
    }

    TopicPost {
        string id PK
        string topicId FK
        string userId FK
        string text
        datetime createdAt
    }

    EmployeeNote {
        string id PK
        string subjectId FK
        string authorId FK
        string text
        datetime createdAt
    }

    OrgSettings {
        string id PK
        string organizationId FK_UK
        boolean aiEnabled
        boolean aiAutoPlanner
        boolean aiAnomalyDetection
        boolean aiChatEnabled
        boolean aiForecast
        boolean aiSmartBriefing
        boolean smsEnabled
    }
```
