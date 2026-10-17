import { PublicPage, publicText, SUPPORT_EMAIL } from "@/components/landing/public-shell";
import { getRequestI18n } from "@/lib/i18n/server";

type Section = { id: string; title: [string, string]; paragraphs: [string, string][] };

const privacy: Section[] = [
  { id: "operator", title: ["Who we are", "运营者与适用范围"], paragraphs: [
    ["Fugue is an independently operated application deployment and hosting platform at fugue.pro. This policy explains how the Fugue operator handles information when you visit our website, create an account, deploy applications, or contact support. Contact the operator at support@fugue.pro for privacy questions.", "Fugue 是由独立开发者运营的应用部署与托管平台，网站为 fugue.pro。本政策说明 Fugue 运营者如何处理您访问网站、创建账户、部署应用或联系支持时的信息。隐私问题请通过 support@fugue.pro 联系运营者。"],
  ] },
  { id: "information", title: ["Information we process", "我们处理的信息"], paragraphs: [
    ["Account information includes your email address, display name, profile picture, authentication identifiers and, when you choose password login, a password hash. If you sign in with Google or GitHub, we receive the profile and account information authorized through that provider.", "账户信息包括邮箱地址、显示名称、头像、身份验证标识，以及选择密码登录时的密码哈希。使用 Google 或 GitHub 登录时，我们会接收您通过该提供商授权的个人资料与账户信息。"],
    ["Hosting information includes repositories and source code you authorize or upload, container images, deployment settings, domains, environment variables and secrets, stored application data, build and runtime logs, and resource usage. Technical records can include IP addresses, request metadata, timestamps, errors and security or audit events.", "托管信息包括您授权或上传的代码仓库与源代码、容器镜像、部署设置、域名、环境变量与密钥、存储的应用数据、构建和运行日志，以及资源用量。技术记录可能包括 IP 地址、请求元数据、时间戳、错误及安全或审计事件。"],
    ["Billing records include purchase identifiers, payer email, payment status, amounts, currency and credit-balance changes. Card details are entered in Creem's checkout; Fugue does not collect or store full payment card numbers. Support messages include the information you choose to send us.", "账单记录包括购买标识、付款邮箱、支付状态、金额、币种与额度变动。银行卡信息在 Creem 的收银台填写，Fugue 不收集或存储完整银行卡号。支持消息包括您主动提供给我们的信息。"],
  ] },
  { id: "use", title: ["Why we use information", "信息用途"], paragraphs: [
    ["We use this information to authenticate accounts, build and run your applications, provision resources, calculate charges, credit payments, troubleshoot problems, prevent abuse, respond to support requests and meet applicable recordkeeping obligations. Where data-protection law requires a legal basis, these activities rely on providing the requested service, legitimate interests in security and reliable operation, legal obligations, or consent where required.", "我们使用这些信息验证账户、构建与运行应用、提供资源、计算费用、处理付款入账、排查故障、防止滥用、响应支持请求及履行适用的记录保存义务。在数据保护法律要求合法依据时，这些处理活动基于提供您请求的服务、保障安全和可靠运行的合法利益、法定义务，或在必要时取得的同意。"],
  ] },
  { id: "providers", title: ["Providers and disclosure", "服务提供商与信息披露"], paragraphs: [
    ["We use infrastructure and storage providers to operate hosting, Resend to deliver account emails, Google and GitHub for optional sign-in and repository connections, and Creem for checkout and payment administration. Website fonts are loaded from Google Fonts, which receives ordinary browser connection information. These providers receive information needed for their role and may apply their own privacy policies.", "我们使用基础设施和存储提供商运营托管服务，使用 Resend 发送账户邮件，使用 Google 和 GitHub 提供可选登录及仓库连接，并使用 Creem 提供收银台和支付管理。网站字体从 Google Fonts 加载，该服务会接收通常的浏览器连接信息。这些提供商会接收履行其职责所需的信息，并可能适用其自身的隐私政策。"],
    ["When you publish an application, its public content is accessible to visitors. When you choose a third-party or shared server, its operator controls the underlying machine; consider this before deploying sensitive workloads. We may disclose information when required by law or necessary to investigate abuse and protect users or the service. We do not sell personal information.", "当您发布应用时，访客可访问其公开内容。选择第三方或共享服务器时，该服务器的运营者控制底层机器；部署敏感业务前请考虑这一点。在法律要求、调查滥用或保护用户及服务所必需时，我们可能披露信息。我们不出售个人信息。"],
  ] },
  { id: "cookies", title: ["Cookies and preferences", "Cookie 与偏好设置"], paragraphs: [
    ["We use cookies for sign-in sessions, authentication security, language and theme preferences. Blocking essential cookies can prevent sign-in or other account functions. You can remove cookies in your browser and change language or theme in the account menu. External sign-in and checkout providers manage cookies on their own sites.", "我们使用 Cookie 保存登录会话、保障身份验证安全，并记住语言和主题偏好。阻止必要 Cookie 可能导致无法登录或使用账户功能。您可以在浏览器中清除 Cookie，并在账户菜单中修改语言或主题。外部登录和支付提供商自行管理其网站上的 Cookie。"],
  ] },
  { id: "retention", title: ["Retention, security and locations", "保存期限、安全与处理地点"], paragraphs: [
    ["We retain information as needed to operate your account and hosting services, resolve disputes, maintain security and comply with applicable legal obligations. Retention varies by data type; billing records and limited security or backup records may need to remain after an account closes. Contact us to request deletion and information about the records that must be retained.", "我们会在运营账户与托管服务、解决争议、维护安全和履行适用法定义务所需的期限内保存信息。不同类型数据的保存期限有所不同；账户关闭后，账单记录及有限的安全或备份记录可能仍需保留。您可以联系我们申请删除，并了解哪些记录必须继续保存。"],
    ["We use access controls and other technical safeguards, but no online service can guarantee absolute security. Processing may take place where our infrastructure and providers operate, including outside your country. Where required, applicable safeguards must be used for international transfers. Keep your own backups and avoid including credentials or unnecessary personal data in application logs.", "我们采用访问控制等技术保护措施，但任何在线服务都无法保证绝对安全。信息可能在我们及服务提供商的基础设施所在地处理，包括您所在国家以外的地区；在法律要求时，跨境传输须采用适用的保障措施。请自行保存备份，并避免在应用日志中包含凭证或非必要个人数据。"],
  ] },
  { id: "rights", title: ["Your choices and rights", "您的选择与权利"], paragraphs: [
    ["You can update available profile details and manage connected accounts in the dashboard. To request access, correction, export or deletion of your personal information or closure of your account, email support@fugue.pro from your account address. We may verify your identity. Depending on applicable law, you may also have rights to restrict or object to processing, withdraw consent, and complain to a data-protection authority.", "您可以在控制台更新可编辑的个人资料并管理已关联账户。如需访问、更正、导出或删除个人信息，或关闭账户，请使用账户邮箱联系 support@fugue.pro。我们可能核实您的身份。根据适用法律，您还可能享有限制或反对处理、撤回同意，以及向数据保护机构投诉的权利。"],
    ["If you collect personal data through an application hosted on Fugue, you are responsible for your application's privacy notice and lawful collection and use of that data. This policy covers Fugue's platform and is not a replacement for your application's policy.", "如果您通过托管在 Fugue 上的应用收集个人数据，您需负责提供该应用的隐私说明，并确保合法收集和使用数据。本政策适用于 Fugue 平台，不能替代您应用自身的隐私政策。"],
  ] },
  { id: "updates", title: ["Policy updates", "政策更新"], paragraphs: [
    ["We may update this policy as the service changes. The date on this page identifies the current version; material changes will be communicated through the website or account email as appropriate.", "我们可能随服务变化更新本政策。本页日期标识当前版本；重大变更将视情况通过网站或账户邮箱告知。"],
  ] },
];

const terms: Section[] = [
  { id: "service", title: ["The service and operator", "服务与运营者"], paragraphs: [
    ["Fugue is an independently operated application deployment and hosting platform at fugue.pro. These terms govern your use of Fugue's website, dashboard, CLI and hosting services. Contact the Fugue operator at support@fugue.pro. You must have legal capacity to enter into these terms and authority to act for any organization you represent.", "Fugue 是由独立开发者运营的应用部署与托管平台，网站为 fugue.pro。本条款适用于 Fugue 网站、控制台、命令行工具及托管服务。联系运营者请发送邮件至 support@fugue.pro。您须具备订立本条款的法律能力，并在代表组织使用服务时取得相应授权。"],
  ] },
  { id: "accounts", title: ["Accounts and your applications", "账户与您的应用"], paragraphs: [
    ["Provide accurate account information and protect your credentials, API keys and connected accounts. You are responsible for activity under your account, your deployments, and the rights and permissions needed to host your content. You retain ownership of your code and data and authorize Fugue to process them as needed to provide the service. Keep independent backups of important data.", "请提供准确的账户信息，并妥善保护凭证、API 密钥和关联账户。您对账户活动、部署内容及托管内容所需的权利与许可负责。代码和数据的所有权仍归您所有，您授权 Fugue 在提供服务所需的范围内处理这些内容。请为重要数据保留独立备份。"],
  ] },
  { id: "billing", title: ["Pricing, credits and delivery", "价格、额度与交付"], paragraphs: [
    ["Fugue sells prepaid service credits in USD through one-time purchases. Credits pay for Fugue hosting resources; they are not an investment, a bank deposit or a transferable currency. There is no automatically renewing subscription or automatic top-up in the current checkout flow. Available purchase amounts and standard resource rates are shown on the Pricing page; review your account's applicable rates and estimates before allocating resources.", "Fugue 通过一次性购买提供以美元计价的预付服务额度。额度用于支付 Fugue 托管资源费用，不属于投资、银行存款或可转让货币。当前支付流程没有自动续订订阅或自动充值。可购买金额和标准资源单价见价格页；分配资源前，请查看账户适用的单价及估算。"],
    ["Managed resource charges accrue hourly based on the configured CPU, memory and storage allocation, including capacity that is reserved but idle. Additional billable resources, including retained images or separately priced servers, may incur charges shown in the dashboard. Merely stopping an application does not necessarily release its resource allocation or stored data. Reduce or release billable resources and check the billing dashboard to stop further charges.", "托管资源按配置的 CPU、内存和存储额度逐小时计费，包括已预留但闲置的容量。保留的镜像或单独定价的服务器等额外计费资源可能产生控制台所示的费用。仅停止应用不一定会释放其资源额度或存储数据。如需停止后续扣费，请减少或释放计费资源，并检查账单控制台。"],
    ["Delivery is digital: after payment confirmation, purchased credits are added to your account and can be used for eligible hosting resources. Provisioning remains subject to capacity, account status and technical requirements. If payment succeeds but credits do not appear, contact support with the order reference. Applicable taxes and the final payment total are shown at checkout. For purchases processed by Creem, its buyer terms also apply to the payment transaction.", "服务以数字方式交付：付款确认后，所购额度会加入您的账户，可用于符合条件的托管资源。资源开通仍受可用容量、账户状态和技术要求约束。如付款成功但额度未到账，请提供订单编号联系支持。适用税费和最终支付金额在收银台展示。通过 Creem 处理的购买，其支付交易还适用 Creem 的买家条款。"],
  ] },
  { id: "refunds", title: ["Refunds and billing issues", "退款与账单问题"], paragraphs: [
    ["To request a refund, email support@fugue.pro with your account email, order reference, purchase date and reason. Do not send card numbers or account passwords. We review unused-credit requests individually based on the unused balance, service delivery and the circumstances of the purchase; approval is not automatic. Charges for resources already provided are generally not refundable, except for billing errors, service failures that justify a refund, or where required by law.", "申请退款请发送邮件至 support@fugue.pro，提供账户邮箱、订单编号、购买日期和原因，请勿发送银行卡号或账户密码。未使用额度的退款申请会根据剩余额度、服务交付和购买具体情况逐一审核，并非自动批准。已经提供的资源所产生的费用通常不予退还，但计费错误、应予退款的服务故障或法律要求的情况除外。"],
    ["Report duplicate payments, incorrect charges or missing credits so we can investigate and correct them. Approved refunds are handled through the payment provider to the original payment method where supported; processing time depends on the provider and your bank. Promotional credits are not refundable for cash. This policy does not limit mandatory consumer rights or remedies available under applicable law or the payment provider's applicable terms.", "请及时报告重复付款、错误扣费或额度未到账，以便我们核实并纠正。获批退款将在支付提供商支持的情况下退回原付款方式，到账时间取决于支付提供商和银行。赠送额度不能兑换现金退款。本政策不限制适用法律规定的消费者强制性权利，或支付提供商适用条款所提供的救济。"],
  ] },
  { id: "acceptable-use", title: ["Acceptable use", "可接受的使用方式"], paragraphs: [
    ["Do not use Fugue for unlawful content or activity, infringement, malware, phishing, spam, unauthorized access, attacks, fraud or abuse of computing resources. Do not bypass resource limits, security controls or payment requirements, or interfere with other users. You must comply with applicable law and the policies of providers involved in your deployment and payment.", "不得使用 Fugue 从事违法内容或活动、侵权、恶意软件、网络钓鱼、垃圾信息、未授权访问、攻击、欺诈或计算资源滥用。不得绕过资源限制、安全控制或付款要求，也不得干扰其他用户。您必须遵守适用法律及部署和支付所涉及提供商的政策。"],
  ] },
  { id: "availability", title: ["Availability and suspension", "可用性与服务限制"], paragraphs: [
    ["The service may be interrupted by maintenance, infrastructure failures or events beyond our control. We do not promise uninterrupted availability or a service-level guarantee unless separately agreed in writing. Insufficient credit may restrict resource operations or service availability. We may restrict or suspend accounts when necessary to address nonpayment, abuse, security threats or legal requirements, with notice where practicable.", "维护、基础设施故障或超出我们控制范围的事件可能造成服务中断。除非另有书面约定，我们不承诺服务持续不中断或特定服务等级。额度不足可能限制资源操作或服务可用性。在处理未付款、滥用、安全威胁或法律要求所必需时，我们可能限制或暂停账户，并在可行时发出通知。"],
  ] },
  { id: "closure", title: ["Ending your use", "停止使用与账户关闭"], paragraphs: [
    ["You may stop using Fugue and request account closure by contacting support. Before closing your account, export data you need, release billable resources and resolve outstanding charges. Closing an account does not automatically refund remaining credits; submit a refund request as described above. Data handling after closure is described in the Privacy Policy.", "您可以停止使用 Fugue 并联系支持申请关闭账户。关闭前，请导出所需数据、释放计费资源并结清未付费用。关闭账户不会自动退还剩余额度；如需退款，请按上述流程提出申请。账户关闭后的数据处理见隐私政策。"],
  ] },
  { id: "responsibility", title: ["Responsibility and changes", "责任与条款变更"], paragraphs: [
    ["To the extent permitted by applicable law, the service is provided as available without additional warranties, and Fugue is not responsible for indirect or consequential losses. Nothing in these terms excludes liability or consumer rights that cannot legally be excluded. Contact support first to discuss service or billing disputes. We may update these terms and pricing prospectively, publishing the changes and providing notice of material changes through the website or account email as appropriate.", "在适用法律允许的范围内，服务按可用状态提供，不附加其他保证，Fugue 不对间接或后果性损失负责。本条款不排除法律禁止排除的责任或消费者权利。如有服务或账单争议，请先联系支持。我们可能对未来适用的条款和价格作出调整，并公布变更；重大变更将视情况通过网站或账户邮箱告知。"],
  ] },
];

export default async function Policy({ kind }: { kind: "privacy" | "terms" }) {
  const { locale } = await getRequestI18n();
  const text = (en: string, zh: string) => publicText(locale, en, zh);
  const sections = kind === "privacy" ? privacy : terms;
  return (
    <PublicPage locale={locale}
      title={kind === "privacy" ? text("Privacy Policy", "隐私政策") : text("Terms of Service", "服务条款")}
      intro={text("Effective October 17, 2026 · Fugue Cloud", "生效日期：2026 年 10 月 17 日 · Fugue Cloud")}>
      <nav className="doc-toc" aria-label={text("On this page", "本页内容")}>
        {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{text(...section.title)}</a>)}
      </nav>
      {sections.map((section) => (
        <section className="doc-section" id={section.id} key={section.id}>
          <h2>{text(...section.title)}</h2>
          {section.paragraphs.map((paragraph) => <p className="doc-p" key={paragraph[0]}>{text(...paragraph)}</p>)}
        </section>
      ))}
      <div className="doc-note public-links">
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
        <a href="/pricing">{text("Pricing", "价格")}</a>
        <a href={kind === "privacy" ? "/terms" : "/privacy"}>{kind === "privacy" ? text("Terms of Service", "服务条款") : text("Privacy Policy", "隐私政策")}</a>
        <a href={kind === "privacy" ? "https://www.creem.io/privacy" : "https://www.creem.io/buyer-terms"}>{text("Creem's applicable policy", "Creem 适用政策")}</a>
      </div>
    </PublicPage>
  );
}
