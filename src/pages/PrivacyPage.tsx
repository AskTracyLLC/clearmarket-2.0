import { PageHeader } from "@/components/PageHeader";

const PrivacyPage = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <PageHeader
        title="Privacy Policy"
        backTo="/dashboard"
      />
      
      <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
        <p className="text-lg">
          Your privacy is important to us. This policy explains how ClearMarket collects, uses, and protects your information.
        </p>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. Information We Collect</h2>
          <p>
            We collect information you provide directly to us, such as when you create an account, 
            update your profile, or communicate with other users through our platform.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. How We Use Your Information</h2>
          <p>
            We use the information we collect to provide, maintain, and improve our services, 
            to process transactions, and to communicate with you about your account and our services.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Information Sharing</h2>
          <p>
            We do not sell your personal information. We share information only as described in this 
            policy, such as with other users as part of the platform's functionality, with service 
            providers who assist us, or as required by law.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. Data Security</h2>
          <p>
            We take reasonable measures to help protect your personal information from loss, theft, 
            misuse, unauthorized access, disclosure, alteration, and destruction.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Your Rights</h2>
          <p>
            You have the right to access, update, or delete your personal information at any time. 
            You can manage most of your information through your account settings.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Contact Us</h2>
          <p>
            If you have any questions about this Privacy Policy, please contact us at{" "}
            <a href="mailto:hello@useclearmarket.io" className="text-primary hover:underline">
              hello@useclearmarket.io
            </a>.
          </p>
        </section>

        <p className="text-sm text-muted-foreground/70 mt-12">
          Last updated: January 2025
        </p>
      </div>
    </div>
  );
};

export default PrivacyPage;
