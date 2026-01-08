import { PageHeader } from "@/components/PageHeader";

const TermsPage = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
        <PageHeader
          title="ClearMarket Terms of Service"
          backTo="/dashboard"
        />
        <p className="text-sm text-muted-foreground mb-8">Last Updated: December 2025</p>
        
        <div className="prose prose-invert max-w-none space-y-6 text-muted-foreground">
          <p className="text-lg">
            Welcome to ClearMarket. By using our platform, you agree to these Terms of Service ("Terms").
          </p>
          <p>
            These Terms form a binding agreement between you ("you," "User") and Ask Tracy LLC d/b/a ClearMarket 
            ("ClearMarket," "we," "us," or "our"). If you do not agree to these Terms, you may not access or use the platform.
          </p>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">1. What ClearMarket Is (and Is Not)</h2>
            <p>ClearMarket is a networking and coverage-matching platform for:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Field Reps</strong> – independent contractors who perform property inspections and related services; and</li>
              <li><strong>Vendors</strong> – companies or individuals who assign those inspections.</li>
            </ul>
            <p className="mt-4">ClearMarket helps Field Reps and Vendors:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Create profiles and list service areas, inspection types, systems used, and preferences</li>
              <li>Search for and discover each other based on coverage, work types, and other criteria</li>
              <li>Exchange contact details (when unlocked)</li>
              <li>Share verified reviews after confirmed work is completed</li>
              <li>Participate in a community board and access analytics or insights (including paid features)</li>
            </ul>
            <p className="mt-4">ClearMarket:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Does not dispatch work</li>
              <li>Does not hire or employ Field Reps</li>
              <li>Is not a party to any work agreement between Field Reps and Vendors</li>
              <li>Does not mediate or guarantee payment, job performance, or outcomes once contact is exchanged</li>
            </ul>
            <p className="mt-4">All work relationships formed through ClearMarket are strictly independent contractor relationships between Users.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">2. Acceptance of Terms</h2>
            <p>By accessing or using ClearMarket (including browsing, creating an account, or participating in the community), you:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Agree to be bound by these Terms and all policies referenced in them</li>
              <li>Confirm that you are legally able to enter into contracts</li>
              <li>Agree that your use of ClearMarket is at your own risk and subject to these Terms</li>
            </ul>
            <p className="mt-4">If you do not agree, you must stop using the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">3. Eligibility & Verification</h2>
            <p>To use ClearMarket, you must:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Be at least 18 years old (or the age of majority in your jurisdiction)</li>
              <li>Use the platform for business or professional purposes</li>
              <li>Comply with all applicable laws, regulations, and licensing/insurance requirements that apply to your work</li>
            </ul>
            <p className="mt-4">
              ClearMarket may require additional verification (such as ID verification, phone or email confirmation, or proof of business activity) 
              before you can unlock contact details, post reviews, or access certain paid or community features. We may refuse, limit, or revoke 
              verification at our discretion.
            </p>
            <p className="mt-4">We may suspend or terminate access if we believe you are not eligible or have violated these Terms.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">4. User Accounts & Security</h2>
            <p>You may need an account to access certain features. You agree to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Provide accurate and complete information</li>
              <li>Keep your login credentials confidential</li>
              <li>Not share your account with others</li>
              <li>Notify us immediately if you suspect unauthorized access</li>
            </ul>
            <p className="mt-4">You are responsible for all activity that occurs under your account, including actions by anyone using your login.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">5. Professional Conduct & Community Standards</h2>
            <p>When using ClearMarket (including profiles, messages, reviews, and the community board), you agree to conduct yourself professionally. This includes:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Honest representation of your qualifications, experience, coverage areas, systems used, and pricing</li>
              <li>Timely communication with other Users, especially after connecting about potential work</li>
              <li>Respectful interactions – no harassment, hate speech, threats, or abusive behavior</li>
              <li>Accurate reviews that reflect your actual experience with another User</li>
              <li>No doxxing or sharing sensitive borrower/property info (e.g., full borrower names, exact property addresses, loan numbers) on public parts of the platform</li>
            </ul>
            <p className="mt-4">You may not use ClearMarket to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Spam, solicit, or harass other Users</li>
              <li>Post misleading, defamatory, or false information</li>
              <li>Circumvent platform controls (for example, scraping contact details at scale or bypassing credit/subscription features)</li>
            </ul>
            <p className="mt-4">We may remove content, limit features, or suspend accounts that violate these standards.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">6. Public Profiles, Privacy & Visibility</h2>
            
            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">6.1 Public Profile Content</h3>
            <p>By default, your public profile may display:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your name or business name</li>
              <li>General service areas (e.g., states, counties, or regions)</li>
              <li>Inspection types and work categories</li>
              <li>Systems/platforms you use</li>
              <li>Limited non-sensitive business information you choose to share</li>
            </ul>
            <p className="mt-4">
              ClearMarket does not publicly display your specific pricing or per-job fees by default. Any pricing you choose to share is visible 
              only in direct interactions (such as messages or files you exchange with other Users) unless you explicitly publish it yourself.
            </p>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">6.2 Disabling Public Visibility</h3>
            <p>You may choose to limit or disable the public visibility of your profile within the platform settings. If you do so:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Certain information may remain visible to Users you are already connected with or have already messaged</li>
              <li>We may retain and use your data internally and in anonymized/aggregated form as described in these Terms</li>
              <li>Some minimal information may be used for fraud prevention, security, or legal compliance</li>
            </ul>
            <p className="mt-4">Disabling public visibility does not retroactively remove information from prior communications with other Users.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">7. Use License</h2>
            <p>ClearMarket grants you a limited, revocable, non-transferable, non-exclusive license to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Access and use the platform for your own business or professional purposes</li>
              <li>View and interact with content made available to you through the platform</li>
            </ul>
            <p className="mt-4">This license does NOT allow you to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Copy, scrape, harvest, or systematically download profiles, analytics, or data for resale or external use</li>
              <li>Reverse-engineer, decompile, or otherwise attempt to access source code</li>
              <li>Use ClearMarket to build or train a competing product or service</li>
            </ul>
            <p className="mt-4">All rights not expressly granted are reserved by ClearMarket.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">8. Independent Contractor Status & Job Relationships</h2>
            <p>ClearMarket is not a party to any agreement between Field Reps and Vendors.</p>
            <p className="mt-4">By using ClearMarket, you acknowledge and agree that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Field Reps are independent contractors, not employees, agents, or partners of ClearMarket</li>
              <li>Vendors are independent businesses, not partners or joint venturers of ClearMarket</li>
              <li>ClearMarket does not control, supervise, or guarantee:
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Whether a Vendor issues work</li>
                  <li>Whether a Field Rep accepts or completes work</li>
                  <li>The quality, timeliness, or outcome of any job</li>
                  <li>Payment terms or amounts</li>
                </ul>
              </li>
            </ul>
            <p className="mt-4">
              Any non-disclosure agreements (NDAs), independent contractor agreements, or work agreements between Field Reps and Vendors are strictly 
              between those parties. ClearMarket is not responsible for drafting, enforcing, or monitoring those agreements.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">9. Payments, Credits, Subscriptions & Refunds</h2>
            <p>ClearMarket may offer:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Credits used for actions like unlocking contact details, boosting posts, or modifying feedback visibility</li>
              <li>Subscription tiers for Vendors and Field Reps that unlock additional analytics and features (e.g., market pricing insights, coverage difficulty, trend reports)</li>
            </ul>
            <p className="mt-4">By purchasing credits, subscriptions, or other paid offerings, you agree:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>To provide accurate payment information and authorize us (and our payment processors) to charge your card or payment method</li>
              <li>That fees are due at the time of purchase and may be recurring if you subscribe</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">9.1 Refund & Chargeback Policy</h3>
            <p>Our Refund & Chargeback Policy is incorporated into these Terms by reference and forms part of your agreement with ClearMarket. In general:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Most fees are non-refundable once access to a feature (e.g., contact unlock, boost) has been delivered</li>
              <li>Refunds may be considered only in limited cases such as:
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>Outdated or invalid contact info</li>
                  <li>Duplicate charges</li>
                  <li>Failed boosts or features not delivered as described</li>
                </ul>
              </li>
              <li>Refund requests must be submitted within the time window defined in the Refund & Chargeback Policy and include supporting details</li>
              <li>Filing chargebacks without first contacting ClearMarket support may result in suspension or permanent removal of your account</li>
            </ul>
            <p className="mt-4">Please review the full Refund & Chargeback Policy posted on our site for details.</p>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">9.2 New or Modified Features and Pricing</h3>
            <p>
              ClearMarket may introduce new features (free or paid), modify existing features, or change pricing over time. Any new or modified feature 
              you choose to use will also be subject to these Terms and any additional terms presented at the time of purchase or use.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">10. Verified Reviews, Ratings & Analytics</h2>
            <p>
              ClearMarket allows Users to leave verified reviews about each other after confirming they have worked together, including ratings for 
              on-time performance, quality of work, and communication. Reviews may contribute to Trust Scores, Community Scores, and other metrics on the platform.
            </p>
            <p className="mt-4">By using these features, you agree that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You will only post reviews when you have actually worked with the other User</li>
              <li>Your reviews will be truthful, fair, and based on your real experience</li>
              <li>You understand that certain actions (e.g., marking a review as "feedback only," hiding or unhiding scores, or boosting visibility) may involve paid features</li>
            </ul>
            <p className="mt-4">ClearMarket may:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Display, sort, or summarize reviews and ratings</li>
              <li>Use review data to power analytics, Trust Meters, Community Scores, scorecards, and search rankings</li>
              <li>Remove or limit visibility of reviews we reasonably believe to be abusive, fraudulent, or in violation of these Terms</li>
            </ul>
            <p className="mt-4">You understand and agree that ClearMarket does not owe you a particular score or review outcome and does not guarantee that reviews will be error-free or free of bias.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">11. Community Board & User-Generated Content</h2>
            <p>The ClearMarket community board and any similar features (e.g., comments, posts, pinging "Under Review" posts) are intended to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Share knowledge and support</li>
              <li>Discuss coverage, workflow, and industry topics</li>
              <li>Allow Users to mark posts as helpful, not helpful, or report them</li>
            </ul>
            <p className="mt-4">By posting content, you grant ClearMarket a worldwide, non-exclusive, royalty-free license (with the right to sublicense) to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Host, store, display, and distribute your content</li>
              <li>Use your content in anonymized or aggregated form to improve the platform and generate analytics</li>
            </ul>
            <p className="mt-4">You may not post:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Borrower or property-identifying information (e.g., full borrower names, specific property addresses, loan IDs)</li>
              <li>Confidential client materials that you do not have the right to share</li>
              <li>Content that is illegal, defamatory, harassing, or otherwise harmful</li>
            </ul>
            <p className="mt-4">
              ClearMarket may hide, grey out, or remove content that receives repeated flags or appears to violate these Terms. We may also restrict posting 
              privileges for Users who repeatedly violate community standards. Community-related actions (such as flags or helpful votes) may influence Community Scores or other metrics.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">12. Non-Disclosure & Confidential Information</h2>
            
            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">12.1 Your Confidentiality Obligations</h3>
            <p>In using ClearMarket, you may gain access to non-public information from ClearMarket and other Users, including but not limited to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Vendor or Field Rep pricing details</li>
              <li>Coverage strategies and internal workflows</li>
              <li>Business contact information shared through unlocks or direct messages</li>
              <li>Non-public data, insights, or analytics</li>
              <li>Any information labeled or reasonably understood as "confidential"</li>
            </ul>
            <p className="mt-4">You agree that:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You will not disclose, share, or publish such non-public information outside of ClearMarket without the prior written consent of the party that provided it (ClearMarket or another User).</li>
              <li>You will use such information solely for the purpose of exploring, managing, or performing work relationships formed via ClearMarket.</li>
              <li>You will take reasonable steps to protect this information from unauthorized use or disclosure (for example, not posting screenshots of internal pricing dashboards or another User's profile data in public forums).</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">12.2 ClearMarket's Use of Aggregated Data</h3>
            <p>ClearMarket may:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Collect and aggregate pricing, coverage, review, and performance data from Users; and</li>
              <li>Use that aggregated and/or anonymized data to provide analytics, benchmarks, and market insights to other Users.</li>
            </ul>
            <p className="mt-4">We will not disclose your personally identifiable, account-level pricing or contact information to other Users except:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>As part of normal platform operations (e.g., when you choose to unlock contact details or share your profile); or</li>
              <li>When required by law, subpoena, or court order.</li>
            </ul>

            <h3 className="text-lg font-medium text-foreground mt-6 mb-3">12.3 Separate NDAs Between Users</h3>
            <p>If Vendors and Field Reps wish to enter a separate NDA for specific jobs or relationships:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>That NDA is between those parties only</li>
              <li>It may impose additional or stricter confidentiality obligations than these Terms</li>
              <li>ClearMarket is not a party to that NDA and is not responsible for enforcing or monitoring compliance</li>
            </ul>
            <p className="mt-4">You are responsible for understanding, negotiating, and complying with any NDA you sign with another User.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">13. Prohibited Uses</h2>
            <p>In addition to the other restrictions in these Terms, you agree not to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Use ClearMarket to violate any law, regulation, or third-party rights</li>
              <li>Interfere with or damage the platform or its infrastructure</li>
              <li>Introduce malware, bots, or automated scraping or data-harvesting tools</li>
              <li>Attempt to access data you are not authorized to view</li>
              <li>Create fake accounts or misrepresent your identity, qualifications, or affiliations</li>
              <li>Use ClearMarket to solicit or promote illegal activities</li>
            </ul>
            <p className="mt-4">
              We may investigate and take appropriate action (including account suspension, termination, or contacting law enforcement) if we believe your use violates these provisions.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">14. Disclaimers</h2>
            <p>ClearMarket is provided on an "as-is" and "as-available" basis.</p>
            <p className="mt-4">To the fullest extent permitted by law, ClearMarket disclaims all warranties, express or implied, including but not limited to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Implied warranties of merchantability, fitness for a particular purpose, and non-infringement</li>
              <li>Any warranty that the platform will be uninterrupted, secure, or error-free</li>
              <li>Any warranty regarding the accuracy, completeness, or reliability of analytics, pricing insights, reviews, or content posted by Users</li>
            </ul>
            <p className="mt-4">ClearMarket does not:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Guarantee that you will find work, find coverage, or reach agreement on any specific rate</li>
              <li>Guarantee the performance, quality, or reliability of any User</li>
              <li>Provide legal, tax, employment, or financial advice</li>
            </ul>
            <p className="mt-4">You are solely responsible for your business decisions, contracts, NDAs, and compliance with all applicable laws.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">15. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>ClearMarket will not be liable for any indirect, incidental, consequential, special, or punitive damages, including loss of profits, revenue, data, or goodwill, arising out of or related to your use of the platform.</li>
              <li>ClearMarket's total cumulative liability for any claims arising out of or related to these Terms or the platform will not exceed the greater of:
                <ul className="list-disc pl-6 mt-2 space-y-1">
                  <li>The amounts you paid to ClearMarket in the three (3) months immediately preceding the claim; or</li>
                  <li>One hundred U.S. dollars (USD $100).</li>
                </ul>
              </li>
            </ul>
            <p className="mt-4">Some jurisdictions do not allow certain limitations, so some of the above may not apply to you. In those cases, ClearMarket's liability will be limited to the greatest extent permitted by law.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">16. Indemnification</h2>
            <p>You agree to indemnify, defend, and hold harmless ClearMarket, its owners, officers, employees, agents, and affiliates from and against any claims, damages, losses, liabilities, costs, and expenses (including reasonable attorneys' fees) arising out of or related to:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Your use of the platform</li>
              <li>Your violation of these Terms</li>
              <li>Your violation of any law or third-party right</li>
              <li>Any dispute between you and another User (including disputes about work quality, timeliness, payment, pricing, or NDAs)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">17. Third-Party Services</h2>
            <p>
              ClearMarket may integrate with or link to third-party services (such as payment processors, communication tools, or other platforms). 
              Your use of those services is subject to the terms and privacy policies of the respective third parties, and we are not responsible for their actions, content, or services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">18. Suspension & Termination</h2>
            <p>We may, at our sole discretion, suspend or terminate your access to some or all of the platform if we believe:</p>
            <ul className="list-disc pl-6 space-y-2">
              <li>You have violated these Terms or other posted policies</li>
              <li>You have engaged in fraud, abuse, or malicious behavior</li>
              <li>Your use creates risk or harm for other Users or for ClearMarket</li>
            </ul>
            <p className="mt-4">
              You may stop using ClearMarket at any time. Certain provisions (including but not limited to confidentiality, payment obligations, limitations of liability, 
              indemnification, and dispute sections) will survive termination.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">19. Changes to the Platform and These Terms</h2>
            <p>We may update or modify ClearMarket's features, pricing, or policies from time to time.</p>
            <p className="mt-4">
              We may also update these Terms. When we do, we will adjust the "Last Updated" date and may provide additional notice (e.g., via email or in-app notice). 
              Your continued use of ClearMarket after changes become effective constitutes your acceptance of the updated Terms.
            </p>
            <p className="mt-4">If you do not agree to the updated Terms, you must stop using the platform.</p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">20. Governing Law & Dispute Resolution</h2>
            <p>These Terms are governed by the laws of the State of Illinois, USA, without regard to its conflict of laws principles, unless the laws of your jurisdiction require otherwise.</p>
            <p className="mt-4">
              Any dispute arising out of or relating to these Terms or your use of ClearMarket will be resolved in the state or federal courts located in Illinois, 
              and you consent to the personal jurisdiction of those courts, unless otherwise required by applicable law.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold text-foreground mt-8 mb-4">21. Contact Information</h2>
            <p>If you have questions about these Terms, the platform, or your account, you can contact us at:</p>
            <p className="mt-4">
              Email:{" "}
              <a href="mailto:hello@useclearmarket.io" className="text-primary hover:underline">
                hello@useclearmarket.io
              </a>
            </p>
          </section>
        </div>
      </div>
  );
};

export default TermsPage;