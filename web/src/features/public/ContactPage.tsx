import { useTranslation } from 'react-i18next';
import { usePageTitle } from '../../lib/use-page-title';
import { ContactDetails } from './ContactDetails';
import { AboutSection, InstagramBand } from './HomeSections';

export function ContactPage() {
  const { t } = useTranslation('public');
  usePageTitle(t('meta.contactTitle'));
  return (
    <>
      <div className="container-content pt-36 pb-8 sm:pt-44">
        <ContactDetails headingLevel={1} />
      </div>
      <AboutSection />
      <InstagramBand />
    </>
  );
}
