import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { PrivacyActions } from '@/components/privacy/PrivacyActions';
import { projectConfig } from '@/config/project.config';

export const metadata: Metadata = {
  title: 'Privacy Policy - Raised Paws',
  description:
    'Learn how Raised Paws protects your privacy and handles your personal information.',
};

export default function PrivacyPolicyPage() {
  const lastUpdated = '2026-08-21';
  const contactEmail = projectConfig.contactEmail;

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          Privacy Policy
        </h1>
      </header>

      <PrivacyActions />

      <article className="prose prose-lg max-w-none">
        <p className="text-base-content/85 mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">1. Introduction</h2>
          <p className="mb-4">
            Raised Paws (&ldquo;we,&rdquo; &ldquo;us&rdquo;) operates{' '}
            <a href="https://raisedpaws.com">raisedpaws.com</a>, an early-access
            pet adoption application tracker for adopters and for shelters and
            rescues. This Privacy Policy explains what personal information we
            collect, how we use it, and the choices you have. It is written for
            transparency during early access; it is not a substitute for legal
            advice.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">2. What We Collect</h2>
          <p className="mb-4">
            Depending on how you use Raised Paws, we may collect:
          </p>
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>
              <strong>Account information</strong> — email address, password
              (stored hashed by our auth provider), and optional profile details
              you provide.
            </li>
            <li>
              <strong>Shelter or rescue information</strong> — organization
              name, location fields, and contact email when you create an
              organization in the shelter portal.
            </li>
            <li>
              <strong>Adoption applications</strong> — answers you submit (for
              example household and contact details) and status history for
              those applications.
            </li>
            <li>
              <strong>Pet listings</strong> — details and photos that shelter
              staff upload for animals available for adoption.
            </li>
            <li>
              <strong>Contact and feedback</strong> — messages you send via our
              contact form or email.
            </li>
            <li>
              <strong>Technical and cookie data</strong> — device/browser basics
              and, if you consent, analytics events. See our{' '}
              <Link href="/cookies" className="link link-primary">
                Cookie Policy
              </Link>
              .
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            3. How We Use Information
          </h2>
          <p className="mb-4">We use personal information to:</p>
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>
              Provide and improve the Raised Paws product (accounts, pipelines,
              tracking).
            </li>
            <li>
              Let adopters apply for pets and see application status updates.
            </li>
            <li>
              Let shelter and rescue staff manage pets and applications for
              their organization.
            </li>
            <li>Respond to support, pilot, and feedback requests.</li>
            <li>
              Understand site usage when you allow analytics cookies (for
              example Google Analytics).
            </li>
          </ul>
          <p className="mb-4">
            We do not sell your personal information. Early access does not mean
            &ldquo;free forever&rdquo;; pricing for optional shelter features
            may change later, but that does not change this policy&apos;s core
            promises about selling data.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            4. Who Sees Your Information
          </h2>
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>
              <strong>You</strong> — your account and the applications you
              submit.
            </li>
            <li>
              <strong>Shelter / rescue staff</strong> — staff linked to an
              organization can see applications and related profile snapshot
              data for pets they list, so they can review adopters.
            </li>
            <li>
              <strong>Service providers</strong> who host or operate the product
              on our behalf, including Supabase (database and authentication),
              GitHub Pages (static site hosting), and Google Analytics (only if
              you consent to analytics cookies).
            </li>
          </ul>
          <p className="mb-4">
            We may disclose information if required by law or to protect the
            safety, rights, or security of users, animals, or the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            5. Cookies and Analytics
          </h2>
          <p className="mb-4">
            We use a consent banner so you can accept, reject, or customize
            non-essential cookies. Analytics (including Google Analytics) loads
            only after you grant analytics consent. Details and preference
            controls: our{' '}
            <Link href="/cookies" className="link link-primary">
              Cookie Policy
            </Link>
            .
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            6. Retention, Deletion, and Your Rights
          </h2>
          <p className="mb-4">
            We keep information as long as your account is active and as needed
            to operate the service, resolve disputes, and meet legal
            obligations. Depending on where you live, you may have rights to
            access, correct, or delete personal data, or to withdraw cookie
            consent.
          </p>
          <p className="mb-4">
            Account and privacy tools in the product (where available) and email
            to {contactEmail} are the primary ways to make a request. We will
            respond within a reasonable time.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">7. Security</h2>
          <p className="mb-4">
            We use industry-standard practices appropriate for an early-access
            web app (including encrypted connections and access controls via our
            providers). No method of transmission or storage is 100% secure.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            8. Children&apos;s Privacy
          </h2>
          <p className="mb-4">
            Raised Paws is not directed at children under 16. We do not
            knowingly collect personal information from children. If you believe
            a child has provided data, contact us and we will take appropriate
            steps.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            9. Changes to This Policy
          </h2>
          <p className="mb-4">
            We may update this Privacy Policy from time to time. We will post
            the revised policy on this page and update the &ldquo;Last
            updated&rdquo; date. For significant changes we may also notify you
            in the product or by email when appropriate.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">10. Contact</h2>
          <p className="mb-4">
            Questions about privacy:{' '}
            <a href={`mailto:${contactEmail}`} className="link link-primary">
              {contactEmail}
            </a>
            {' · '}
            <Link href="/contact" className="link link-primary">
              Contact form
            </Link>
            .
          </p>
          <p className="text-base-content/70 text-sm">
            Related:{' '}
            <Link href="/terms" className="link link-primary">
              Terms of Use
            </Link>
            {' · '}
            <Link href="/cookies" className="link link-primary">
              Cookie Policy
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
