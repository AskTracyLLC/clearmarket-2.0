import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import SignUp from "./pages/SignUp";
import SignIn from "./pages/SignIn";
import RoleSelection from "./pages/RoleSelection";
import Terms from "./pages/Terms";
import Dashboard from "./pages/Dashboard";
import RepProfile from "./pages/RepProfile";
import RepFindWork from "./pages/RepFindWork";
import VendorProfile from "./pages/VendorProfile";
import VendorFindReps from "./pages/VendorFindReps";
import VendorSeekingCoverage from "./pages/VendorSeekingCoverage";
import VendorInterestedReps from "./pages/VendorInterestedReps";
import VendorMyReps from "./pages/VendorMyReps";
import RepMyVendors from "./pages/RepMyVendors";
import MessagesList from "./pages/MessagesList";
import MessageThread from "./pages/MessageThread";
import VendorMessageTemplates from "./pages/VendorMessageTemplates";
import RepMessageTemplates from "./pages/RepMessageTemplates";
import RepFindVendors from "./pages/RepFindVendors";
import RepSeekingCoveragePost from "./pages/RepSeekingCoveragePost";
import VendorAvailability from "./pages/VendorAvailability";
import VendorReviews from "./pages/VendorReviews";
import RepReviews from "./pages/RepReviews";
import RepAvailability from "./pages/RepAvailability";
import RepCalendar from "./pages/RepCalendar";
import PublicReputationSnapshot from "./pages/PublicReputationSnapshot";
import PublicRepReviews from "./pages/PublicRepReviews";
import PublicVendorReviews from "./pages/PublicVendorReviews";
import RepShareProfile from "./pages/RepShareProfile";
import VendorShareProfile from "./pages/VendorShareProfile";
import NotFound from "./pages/NotFound";
import Notifications from "./pages/Notifications";
import NotificationSettings from "./pages/NotificationSettings";
import Settings from "./pages/Settings";
import VendorCredits from "./pages/VendorCredits";
import AdminReports from "./pages/AdminReports";
import AdminModeration from "./pages/AdminModeration";
import AdminInviteCodes from "./pages/AdminInviteCodes";
import AdminUsers from "./pages/AdminUsers";
import AdminStaff from "./pages/AdminStaff";
import SafetyCenter from "./pages/SafetyCenter";
import CommunityBoard from "./pages/CommunityBoard";
import CommunityPostDetail from "./pages/CommunityPostDetail";
import ForgotPassword from "./pages/ForgotPassword";
import UpdatePassword from "./pages/UpdatePassword";
import Support from "./pages/Support";
import AdminSupport from "./pages/AdminSupport";
import AdminAuditLog from "./pages/AdminAuditLog";
import AdminMetrics from "./pages/AdminMetrics";
import AdminCredits from "./pages/AdminCredits";
import AdminInspectionTypes from "./pages/AdminInspectionTypes";
import AdminBackgroundChecks from "./pages/AdminBackgroundChecks";
import HelpCenter from "./pages/HelpCenter";
import TermsPage from "./pages/TermsPage";
import PrivacyPage from "./pages/PrivacyPage";
import RepWorkingTermsRequest from "./pages/RepWorkingTermsRequest";
import VendorWorkingTermsReview from "./pages/VendorWorkingTermsReview";
import AdminLegalHelpCenter from "./pages/AdminLegalHelpCenter";
import AdminSitePageEditor from "./pages/AdminSitePageEditor";
import AdminHelpArticles from "./pages/AdminHelpArticles";
import AdminHelpArticleEditor from "./pages/AdminHelpArticleEditor";
import LegalPage from "./pages/LegalPage";
import PublicHelpCenter from "./pages/PublicHelpCenter";
import WorkSetup from "./pages/WorkSetup";
import RepMatchAssistant from "./pages/RepMatchAssistant";
import VendorMatchAssistant from "./pages/VendorMatchAssistant";
import AdminFeatureFlags from "./pages/AdminFeatureFlags";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      storageKey="clearmarket-theme"
      enableSystem
    >
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/signup" element={<SignUp />} />
              <Route path="/signin" element={<SignIn />} />
              <Route path="/auth/forgot-password" element={<ForgotPassword />} />
              <Route path="/auth/update-password" element={<UpdatePassword />} />
              <Route path="/onboarding/role" element={<RoleSelection />} />
              <Route path="/onboarding/terms" element={<Terms />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/work-setup" element={<WorkSetup />} />
              <Route path="/rep/profile" element={<RepProfile />} />
              <Route path="/rep/find-work" element={<RepFindWork />} />
              <Route path="/rep/seeking-coverage/:postId" element={<RepSeekingCoveragePost />} />
              <Route path="/rep/find-vendors" element={<RepFindVendors />} />
              <Route path="/vendor/profile" element={<VendorProfile />} />
              <Route path="/vendor/find-reps" element={<VendorFindReps />} />
              <Route path="/vendor/seeking-coverage" element={<VendorSeekingCoverage />} />
              <Route path="/vendor/seeking-coverage/:postId/interested" element={<VendorInterestedReps />} />
              <Route path="/vendor/my-reps" element={<VendorMyReps />} />
              <Route path="/vendor/availability" element={<VendorAvailability />} />
              <Route path="/rep/my-vendors" element={<RepMyVendors />} />
              <Route path="/rep/availability" element={<RepAvailability />} />
              <Route path="/rep/calendar" element={<RepCalendar />} />
              <Route path="/rep/match-assistant" element={<RepMatchAssistant />} />
              <Route path="/vendor/match-assistant" element={<VendorMatchAssistant />} />
              <Route path="/messages" element={<MessagesList />} />
              <Route path="/messages/:conversationId" element={<MessageThread />} />
              <Route path="/vendor/message-templates" element={<VendorMessageTemplates />} />
              <Route path="/rep/message-templates" element={<RepMessageTemplates />} />
              <Route path="/vendor/reviews" element={<VendorReviews />} />
              <Route path="/rep/reviews" element={<RepReviews />} />
              <Route path="/vendor/credits" element={<VendorCredits />} />
              <Route path="/notifications" element={<Notifications />} />
              <Route path="/notifications/settings" element={<NotificationSettings />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/admin/reports" element={<AdminReports />} />
              <Route path="/admin/moderation" element={<AdminModeration />} />
              <Route path="/admin/invites" element={<AdminInviteCodes />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/staff" element={<AdminStaff />} />
              <Route path="/admin/support" element={<AdminSupport />} />
              <Route path="/admin/audit" element={<AdminAuditLog />} />
              <Route path="/admin/metrics" element={<AdminMetrics />} />
              <Route path="/admin/credits" element={<AdminCredits />} />
              <Route path="/admin/inspection-types" element={<AdminInspectionTypes />} />
              <Route path="/admin/background-checks" element={<AdminBackgroundChecks />} />
              <Route path="/admin/legal" element={<AdminLegalHelpCenter />} />
              <Route path="/admin/legal/:pageType" element={<AdminSitePageEditor />} />
              <Route path="/admin/help-articles" element={<AdminHelpArticles />} />
              <Route path="/admin/help-articles/:articleId" element={<AdminHelpArticleEditor />} />
              <Route path="/admin/features" element={<AdminFeatureFlags />} />
              <Route path="/support" element={<Support />} />
              <Route path="/help" element={<HelpCenter />} />
              <Route path="/help/:slug" element={<HelpCenter />} />
              <Route path="/legal/:pageType" element={<LegalPage />} />
              <Route path="/safety" element={<SafetyCenter />} />
              <Route path="/community" element={<CommunityBoard />} />
              <Route path="/community/:postId" element={<CommunityPostDetail />} />
              <Route path="/snapshot/:slug" element={<PublicReputationSnapshot />} />
              <Route path="/share/rep/:slug" element={<RepShareProfile />} />
              <Route path="/share/vendor/:slug" element={<VendorShareProfile />} />
              <Route path="/rep/reviews/:id" element={<PublicRepReviews />} />
              <Route path="/vendor/reviews/:id" element={<PublicVendorReviews />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/rep/working-terms-request/:requestId" element={<RepWorkingTermsRequest />} />
              <Route path="/vendor/working-terms-review/:requestId" element={<VendorWorkingTermsReview />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
