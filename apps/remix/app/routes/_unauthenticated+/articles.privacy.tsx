import { getLegalEntity, LEGAL_TERMS_PATH } from '@documenso/lib/constants/legal-entity';
import { SIGNING_CONSENT_VERSION } from '@documenso/lib/constants/signing-consent';
import { msg } from '@lingui/core/macro';
import { Link } from 'react-router';

import { appMetaTags } from '~/utils/meta';

import type { Route } from './+types/articles.privacy';

export function meta() {
  return appMetaTags(msg`Privacy Policy`);
}

export const loader = () => {
  const legalEntity = getLegalEntity();

  // Only published once the operating entity has been configured.
  if (!legalEntity) {
    throw new Response('Not Found', { status: 404 });
  }

  return { legalEntity };
};

export default function PrivacyPolicy({ loaderData }: Route.ComponentProps) {
  const { legalEntity } = loaderData;

  return (
    <article className="prose dark:prose-invert" dir="rtl" lang="he">
      <h1>מדיניות פרטיות</h1>
      <p className="text-muted-foreground text-sm">גרסה: {SIGNING_CONSENT_VERSION}</p>

      <h2>1. מי אחראי על המידע</h2>
      <p>
        שירות החתימה האלקטרונית מופעל על ידי {legalEntity.name}, ח.פ. {legalEntity.number} (״המפעיל״). מדיניות זו מפרטת
        איזה מידע אישי נאסף בעת השימוש בשירות, לאילו מטרות, ומה זכויותיך, בהתאם לחוק הגנת הפרטיות, התשמ״א-1981, ולתקנות
        שהותקנו מכוחו.
      </p>

      <h2>2. איזה מידע נאסף</h2>
      <ul>
        <li>פרטי זיהוי וקשר: שם וכתובת דוא״ל, כפי שנמסרו על ידי שולח המסמך או על ידך.</li>
        <li>החתימה שלך (מצוירת, מוקלדת או תמונה שהעלית), וכן תמונת חותמת ופרטי התאגיד שהצהרת עליהם, אם הועלו.</li>
        <li>תוכן המסמכים שנשלחו אליך לחתימה והשדות שמילאת בהם.</li>
        <li>נתוני תיעוד: כתובת IP, סוג הדפדפן ומערכת ההפעלה, ומועד כל פעולה (פתיחה, צפייה, חתימה).</li>
        <li>נוסח ההסכמות שאישרת לפני החתימה.</li>
      </ul>

      <h2>3. מטרות השימוש במידע</h2>
      <ul>
        <li>הצגת המסמך, החתמתך עליו ומסירת המסמך החתום לצדדים.</li>
        <li>זיהוי החותם ותיעוד ראייתי של החתימה, לרבות במקרה של מחלוקת.</li>
        <li>שליחת הודעות הקשורות למסמך (הזמנה לחתימה, תזכורות, השלמה).</li>
        <li>אבטחת השירות ומניעת שימוש לרעה.</li>
      </ul>

      <h2>4. חובה למסור מידע</h2>
      <p>
        אינך חייב/ת על פי דין למסור את המידע. עם זאת, בלי המידע המפורט לעיל לא ניתן לזהות את החותם ולתעד את החתימה, ולכן
        לא ניתן להשלים את החתימה.
      </p>

      <h2>5. למי המידע נמסר</h2>
      <ul>
        <li>לשולח המסמך ולשאר הצדדים למסמך, כחלק מהמסמך החתום ומתעודת החתימה.</li>
        <li>
          לספקי תשתית הפועלים מטעם המפעיל ולפי הוראותיו: אירוח השרתים ומסד הנתונים (Railway), אחסון קבצים (Cloudflare
          R2) ושליחת דוא״ל.
        </li>
        <li>לרשויות מוסמכות, ככל שהדבר נדרש על פי דין.</li>
      </ul>
      <p>המפעיל אינו מוכר מידע אישי ואינו משתמש בו לשיווק.</p>

      <h2>6. מיקום אחסון המידע</h2>
      <p>המידע נשמר בשרתים באיחוד האירופי, שדיניו מעניקים הגנה למידע אישי ברמה שאינה פחותה מהקבוע בדין הישראלי.</p>

      <h2>7. תקופת שמירת המידע</h2>
      <p>
        מסמכים חתומים ויומני הביקורת שלהם נשמרים {legalEntity.retentionYears} שנים ממועד החתימה, לצורך הוכחת החתימה
        ועמידה בחובות על פי דין. טיוטות ומסמכים שבוטלו לפני השלמתם נמחקים, יחד עם הקבצים שלהם, עם מחיקתם.
      </p>

      <h2>8. אבטחת מידע</h2>
      <p>
        המידע מוצפן בעת העברתו, הגישה אליו מוגבלת לבעלי הרשאה, והמסמכים החתומים נחתמים דיגיטלית כך שניתן לזהות כל שינוי.
        יומן הביקורת נשמר באופן שאינו מאפשר לשנותו או למחוק ממנו. אין מערכת חסינה לחלוטין, ובמקרה של אירוע אבטחה חמור
        יפעל המפעיל כנדרש על פי תקנות הגנת הפרטיות (אבטחת מידע), התשע״ז-2017.
      </p>

      <h2>9. הזכויות שלך</h2>
      <ul>
        <li>לעיין במידע עליך המוחזק אצל המפעיל (סעיף 13 לחוק הגנת הפרטיות).</li>
        <li>לבקש לתקן או למחוק מידע שאינו נכון, שלם, ברור או מעודכן (סעיף 14 לחוק).</li>
      </ul>
      <p>
        ניתן לפנות בבקשה בדוא״ל <a href={`mailto:${legalEntity.contactEmail}`}>{legalEntity.contactEmail}</a>. שים/י לב:
        מסמך שכבר נחתם ויומן הביקורת שלו מהווים ראיה לחתימה ולא ניתן לשנותם, אך ניתן לצרף אליהם הודעת תיקון. כמו כן ניתן
        לפנות לרשות להגנת הפרטיות.
      </p>

      <h2>10. שינויים במדיניות</h2>
      <p>
        המפעיל רשאי לעדכן מדיניות זו. גרסת המדיניות שהייתה בתוקף בעת חתימתך נשמרת ביומן הביקורת. ראו גם את{' '}
        <Link to={LEGAL_TERMS_PATH}>תנאי השימוש</Link>.
      </p>

      <h2>11. יצירת קשר</h2>
      <p>
        {legalEntity.name}
        {legalEntity.address ? `, ${legalEntity.address}` : ''}. דוא״ל:{' '}
        <a href={`mailto:${legalEntity.contactEmail}`}>{legalEntity.contactEmail}</a>
      </p>
    </article>
  );
}
