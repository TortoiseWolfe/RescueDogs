import React from 'react';
import { Metadata } from 'next';
import Link from 'next/link';
import { projectConfig } from '@/config/project.config';

export const metadata: Metadata = {
  title: 'Terms of Use - Raised Paws',
  description:
    'Terms of Use for Raised Paws accounts, early access, and shelter or adopter portals.',
};

export default function TermsOfUsePage() {
  const lastUpdated = '2026-08-21';
  const contactEmail = projectConfig.contactEmail;

  return (
    <main className="container mx-auto max-w-4xl px-4 py-6 sm:py-8 md:py-12">
      <header>
        <h1 className="mb-6 !text-2xl font-bold sm:mb-8 sm:!text-4xl md:!text-5xl">
          Terms of Use
        </h1>
      </header>

      <article className="prose prose-lg max-w-none">
        <p className="text-base-content/85 mb-6 text-sm">
          Last updated: {lastUpdated}
        </p>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">1. Agreement</h2>
          <p className="mb-4">
            By using Raised Paws at{' '}
            <a href="https://raisedpaws.com">raisedpaws.com</a>, creating an
            account, or accessing the adopter or shelter portals, you agree to
            these Terms of Use. If you do not agree, do not use the service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">2. Early Access</h2>
          <p className="mb-4">
            Raised Paws is offered in early access. Features may change, break,
            or be removed as we improve the product. We welcome feedback so we
            can build a better experience for shelters, rescues, and adopters.
          </p>
          <p className="mb-4">
            Early access and founding use may be at no charge for a period we
            define. That is not a promise of free service forever. Optional paid
            shelter features may be introduced later.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">3. Accounts</h2>
          <p className="mb-4">
            You must provide accurate information and keep your login secure.
            You are responsible for activity under your account. Notify us if
            you suspect unauthorized use.
          </p>
          <p className="mb-4">
            Creating a login does not by itself grant shelter membership.
            Shelter and rescue staff create (or are added to) an organization in
            the shelter portal to list pets and see applications.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            4. Adopters and Shelters
          </h2>
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>
              <strong>Adopters</strong> may apply for listed pets and track
              status. Adopters are not charged by Raised Paws to apply or track.
            </li>
            <li>
              <strong>Shelters and rescues</strong> may create an organization,
              list pets, and review applications for their animals. You must
              have authority to represent that organization and to list the
              animals you post.
            </li>
          </ul>
          <p className="mb-4">
            Raised Paws is a coordination tool. We do not guarantee placements,
            approvals, or outcomes. Animal welfare and adoption decisions remain
            with the shelter or rescue.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">5. Acceptable Use</h2>
          <p className="mb-4">You agree not to:</p>
          <ul className="mb-4 list-disc space-y-2 pl-6">
            <li>Misrepresent your identity or affiliation.</li>
            <li>Upload unlawful, abusive, or misleading content.</li>
            <li>
              Attempt to access other users&apos; data without authorization.
            </li>
            <li>
              Disrupt or overload the service, or reverse engineer it except as
              allowed by law.
            </li>
            <li>
              Use the service for spam or commercial exploitation unrelated to
              pet adoption.
            </li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">6. Content You Submit</h2>
          <p className="mb-4">
            You retain rights to content you submit (for example pet photos and
            application answers). You grant us a license to host, display, and
            process that content as needed to operate Raised Paws. Shelter staff
            may see adopter application data for pets they manage.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">7. Disclaimers</h2>
          <p className="mb-4">
            The service is provided &ldquo;as is&rdquo; during early access,
            without warranties of any kind to the fullest extent permitted by
            law. We do not warrant uninterrupted or error-free operation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">
            8. Limitation of Liability
          </h2>
          <p className="mb-4">
            To the fullest extent permitted by law, Raised Paws and its
            operators are not liable for indirect, incidental, or consequential
            damages arising from your use of the service, including adoption
            outcomes or third-party shelter decisions.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">9. Changes</h2>
          <p className="mb-4">
            We may update these Terms by posting a revised version on this page
            and updating the &ldquo;Last updated&rdquo; date. Continued use
            after changes means you accept the updated Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="mb-4 text-2xl font-semibold">10. Contact</h2>
          <p className="mb-4">
            Questions:{' '}
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
            See also our{' '}
            <Link href="/privacy" className="link link-primary">
              Privacy Policy
            </Link>
            .
          </p>
        </section>
      </article>
    </main>
  );
}
