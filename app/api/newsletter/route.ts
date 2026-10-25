import { prisma } from "@/lib/prisma";
import { sendAccountEmail,isPlunkConfigured } from "@/lib/plunk";
import { getLegalSettings } from "@/lib/legal";
import { legalReadiness } from "@/lib/legal-settings-shared";
import { billingOrigin } from "@/lib/creem";
import { newNewsletterToken,tokenHash } from "@/lib/newsletter";
import { isLocale } from "@/lib/i18n/config";
import { copy } from "@/lib/legal-copy";
export const runtime="nodejs";
export async function POST(request:Request) {
  if(request.headers.get("origin")!==billingOrigin())return Response.json({error:"Invalid request origin."},{status:403});
  const input=await request.json().catch(()=>null);
  if(!input||typeof input!=="object"||Array.isArray(input))return Response.json({error:"Invalid request."},{status:400});
  const text=(key:string)=>typeof input[key]==="string"?input[key].trim():"";
  const email=text("email").toLowerCase();const firstName=text("firstName");const lastName=text("lastName");
  const source=input.source==="maintenance"?"maintenance":"footer";
  const locale=isLocale(input.locale)?input.locale:"en";
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||firstName.length>60||lastName.length>60||(source==="footer"&&(!firstName||!lastName)))return Response.json({error:"Please provide your first name, last name and a valid email address."},{status:400});
  const legal=await getLegalSettings();
  if(input.consent!==true||input.consentVersion!==legal.privacyVersion)return Response.json({error:"Please accept the current subscription notice."},{status:400});
  if(legalReadiness(legal).length||!isPlunkConfigured())return Response.json({error:"Subscriptions are temporarily unavailable."},{status:503});
  try {
    const token=newNewsletterToken();
    const subscriber=await prisma.$transaction(async tx=>{
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`newsletter:${email}`}))`;
      const existing=await tx.newsletterSubscriber.findUnique({where:{email_source:{email,source}}});
      if(existing&&((existing.confirmedAt&&!existing.unsubscribedAt)||(existing.confirmationSentAt&&existing.confirmationSentAt.getTime()>Date.now()-600000)))return null;
      const proof={firstName,lastName,locale,consentVersion:legal.privacyVersion,confirmationTokenHash:tokenHash(token),confirmationExpiresAt:new Date(Date.now()+86400000),confirmationSentAt:new Date()};
      return tx.newsletterSubscriber.upsert({where:{email_source:{email,source}},create:{email,source,...proof},update:proof});
    });
    if(subscriber) {
      try {
        await sendAccountEmail({to:email,subject:copy(locale,source==="footer"?"Confirm your CMSMotive newsletter subscription":"Confirm your CMSMotive reopening notification",source==="footer"?"CMSMotive-Newsletter bestätigen":"CMSMotive-Startbenachrichtigung bestätigen",source==="footer"?"CMSMotive bülten aboneliğinizi doğrulayın":"CMSMotive açılış bildiriminizi doğrulayın"),actionUrl:`${billingOrigin()}/newsletter/confirm?token=${token}&lang=${locale}`,actionText:copy(locale,"Confirm subscription","Anmeldung bestätigen","Aboneliği doğrula")});
      }catch{
        await prisma.newsletterSubscriber.updateMany({where:{id:subscriber.id,confirmationTokenHash:tokenHash(token)},data:{confirmationSentAt:null}});
        return Response.json({error:"The confirmation email could not be sent. Please try again later."},{status:502});
      }
    }
    return Response.json({ok:true,pending:true},{status:202});
  }catch{return Response.json({error:"The subscription could not be saved."},{status:500});}
}
