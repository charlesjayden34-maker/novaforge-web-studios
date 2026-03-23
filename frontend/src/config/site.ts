export const siteConfig = {
  brand: {
    name: 'NovaForge Web Studios',
    shortName: 'NovaForge'
  },
  contact: {
    name: 'Nathan Whittaker',
    email: 'nathanwhittaker141@gmail.com'
  },
  bank: {
    accountHolder: 'NATHAN WHITTAKER',
    bankName: 'FCIB',
    branch: 'BROAD STREET',
    branchTransit: '09606',
    accountType: 'Savings',
    accountNumber: '1001283593',
    swiftCode: 'FCIBBBBB'
  }
};

export const websiteTiers = [
  {
    id: 'starter',
    name: 'Starter',
    price: 1200,
    summary: 'Best for new businesses that need a clean online presence fast.'
  },
  {
    id: 'growth',
    name: 'Growth',
    price: 2500,
    summary: 'Best for businesses that need more pages, stronger SEO, and lead capture.'
  },
  {
    id: 'premium',
    name: 'Premium',
    price: 5000,
    summary: 'Best for advanced brands that need custom features and high conversion UX.'
  }
] as const;
