// ============================================================
// AMERICAN SPACES NIGERIA — Programme Pillars & Categories
// ============================================================

export const PILLARS = [
  {
    id: 'education_exchange',
    label: 'Education & Exchange',
    categories: [
      'Conversation with an Alum',
      'EducationUSA Advising Session',
      'Study Abroad Information Session',
      'Exchange Programme Orientation',
      'Alumni Network Meeting',
    ],
  },
  {
    id: 'english_language',
    label: 'English Language',
    categories: [
      'English Access Microscholarship Programme',
      'English Language Class / Club',
      'TOEFL / IELTS Preparation Workshop',
      'Conversation Club',
    ],
  },
  {
    id: 'information_media',
    label: 'Information & Media',
    categories: [
      'Movie Screening',
      'Media Literacy Workshop',
      'Journalism / Reporting Training',
      'Fake News & Disinformation Workshop',
    ],
  },
  {
    id: 'arts_culture',
    label: 'Arts & Culture',
    categories: [
      'Creative Hub',
      'Art Exhibition / Gallery',
      'Cultural Performance / Display',
      'Photography Workshop',
      'Creative Writing Session',
    ],
  },
  {
    id: 'alumni_engagement',
    label: 'Alumni Engagement',
    categories: [
      'Alumni Networking Event',
      'Alumni-Led Community Project',
      'Alumni Speaker Series',
    ],
  },
  {
    id: 'democracy_governance',
    label: 'Democracy & Governance',
    categories: [
      'Civic Education Workshop',
      'Leadership & Governance Forum',
      'Rule of Law Seminar',
      'Women in Leadership Programme',
    ],
  },
  {
    id: 'speak_with_diplomat',
    label: 'Speak with a Diplomat',
    categories: [
      'Diplomat Speaker Session',
      'U.S. Policy Discussion',
      'American Perspectives Forum',
    ],
  },
  {
    id: 'employability_tech',
    label: 'Employability & Tech',
    categories: [
      'Employability Webinar',
      'Apps for Teaching & Learning',
      'Smarter Works with Productivity Apps',
      'Entrepreneurship Workshop',
      'STEM / Coding Session',
      'Thematic Programme',
      'MOOC Camp',
      'Summer Bootcamp',
    ],
  },
];

export const STRATEGIC_PRIORITIES = [
  'Making America Greater',
  'Making America Stronger',
  'Making America More Prosperous',
  'Celebrating American Excellence',
];

export const AI_WORD_LIMITS = [300, 400, 500, 750, 1000];

export const REPORT_STATUSES = {
  draft: { label: 'Draft', color: '#6b7280' },
  submitted: { label: 'Submitted', color: '#f59e0b' },
  coordinator_reviewed: { label: 'Coordinator Reviewed', color: '#3b82f6' },
  specialist_reviewed: { label: 'Specialist Reviewed', color: '#8b5cf6' },
  approved: { label: 'PAO Approved', color: '#10b981' },
};

export const ROLES = {
  admin: { label: 'Admin', canReview: true, canApprove: true },
  pao: { label: 'PAO', canReview: true, canApprove: true },
  specialist: { label: 'Country AS Programme Specialist', canReview: true, canApprove: true },
  coordinator: { label: 'American Spaces Coordinator', canReview: true, canApprove: true },
  space_director: { label: 'Space Director', canReview: false, canApprove: false },
};

// Workflow: what status each role advances a report to
export const WORKFLOW = {
  space_director: { submitsTo: 'submitted', label: 'Submit to Coordinator' },
  coordinator: { submitsTo: 'coordinator_reviewed', label: 'Approve & Forward to Specialist' },
  specialist: { submitsTo: 'specialist_reviewed', label: 'Approve & Forward to PAO' },
  pao: { submitsTo: 'approved', label: 'Give Final Approval' },
  admin: { submitsTo: 'approved', label: 'Give Final Approval' },
};