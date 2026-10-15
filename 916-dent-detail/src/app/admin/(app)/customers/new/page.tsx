import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth/server';
import { createCustomerAction } from '../../../_actions/crm';
import { ActionForm } from '../../../_ui/forms';
import { Field, PageHeader, Section } from '../../../_ui';

export const metadata: Metadata = { title: 'New customer' };

export default async function NewCustomer() {
  await requireStaff();
  return (
    <>
      <PageHeader title="New customer" back={{ href: '/admin/customers', label: 'Customers' }} />
      <Section>
        <ActionForm action={createCustomerAction} submit="Create customer">
          <Field label="Name" htmlFor="name"><input id="name" name="name" required maxLength={80} className="adm-input" autoComplete="off" /></Field>
          <Field label="Mobile phone" htmlFor="phone" help="US number. Used to link repeat customers."><input id="phone" name="phone" type="tel" inputMode="tel" className="adm-input" autoComplete="off" /></Field>
          <Field label="Email" htmlFor="email"><input id="email" name="email" type="email" inputMode="email" className="adm-input" autoComplete="off" /></Field>
        </ActionForm>
      </Section>
    </>
  );
}
