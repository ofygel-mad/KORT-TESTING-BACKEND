with open('src/pages/workzone/chapan/settings/ChapanSettings.tsx', 'rb') as f:
    content = f.read().decode('utf-8')

old = (
    "function ProfileTab() {\n"
    "  const { data: profile, isLoading } = useChapanProfile();\n"
    "  const saveProfile = useSaveProfile();\n"
    "  const [form, setForm] = useState<{ displayName: string; orderPrefix: string; publicIntakeEnabled: boolean } | null>(null);\n"
    "\n"
    "  const current = form ?? {\n"
    "    displayName: profile?.displayName ?? '',\n"
    "    orderPrefix: profile?.orderPrefix ?? '\u0427\u041f',\n"
    "    publicIntakeEnabled: profile?.publicIntakeEnabled ?? false,\n"
    "  };\n"
    "\n"
    "  if (isLoading) return <div className={styles.loading}>\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...</div>;\n"
    "\n"
    "  async function handleSave() {\n"
    "    await saveProfile.mutateAsync(current);\n"
    "    setForm(null);\n"
    "  }\n"
)

new = (
    "type ProfileForm = {\n"
    "  displayName: string;\n"
    "  descriptor: string;\n"
    "  orderPrefix: string;\n"
    "  publicIntakeEnabled: boolean;\n"
    "  publicIntakeTitle: string;\n"
    "  publicIntakeDescription: string;\n"
    "  supportLabel: string;\n"
    "};\n"
    "\n"
    "function ProfileTab() {\n"
    "  const { data: profile, isLoading } = useChapanProfile();\n"
    "  const saveProfile = useSaveProfile();\n"
    "  const [form, setForm] = useState<ProfileForm | null>(null);\n"
    "\n"
    "  const current: ProfileForm = form ?? {\n"
    "    displayName: profile?.displayName ?? '',\n"
    "    descriptor: profile?.descriptor ?? '',\n"
    "    orderPrefix: profile?.orderPrefix ?? '\u0427\u041f',\n"
    "    publicIntakeEnabled: profile?.publicIntakeEnabled ?? false,\n"
    "    publicIntakeTitle: profile?.publicIntakeTitle ?? '',\n"
    "    publicIntakeDescription: profile?.publicIntakeDescription ?? '',\n"
    "    supportLabel: profile?.supportLabel ?? '',\n"
    "  };\n"
    "\n"
    "  if (isLoading) return <div className={styles.loading}>\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...</div>;\n"
    "\n"
    "  async function handleSave() {\n"
    "    await saveProfile.mutateAsync(current);\n"
    "    setForm(null);\n"
    "  }\n"
)

if old in content:
    content = content.replace(old, new)
    print('profile state fixed')
else:
    print('NOT found')

# Now extend the JSX to show the new fields
old_jsx = (
    "        <div className={styles.profileField}>\n"
    "          <label className={styles.profileLabel}>\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043c\u0430\u0441\u0442\u0435\u0440\u0441\u043a\u043e\u0439</label>\n"
    "          <input\n"
    "            className={styles.profileInput}\n"
    "            value={current.displayName}\n"
    "            onChange={e => setForm({ ...current, displayName: e.target.value })}\n"
    "            placeholder=\"\u0427\u0430\u043f\u0430\u043d \u0410\u0442\u0435\u043b\u044c\u0435\"\n"
    "          />\n"
    "        </div>\n"
)

new_jsx = (
    "        <div className={styles.profileField}>\n"
    "          <label className={styles.profileLabel}>\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043c\u0430\u0441\u0442\u0435\u0440\u0441\u043a\u043e\u0439</label>\n"
    "          <input\n"
    "            className={styles.profileInput}\n"
    "            value={current.displayName}\n"
    "            onChange={e => setForm({ ...current, displayName: e.target.value })}\n"
    "            placeholder=\"\u0427\u0430\u043f\u0430\u043d \u0410\u0442\u0435\u043b\u044c\u0435\"\n"
    "          />\n"
    "        </div>\n"
    "        <div className={styles.profileField}>\n"
    "          <label className={styles.profileLabel}>\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 (\u0434\u043b\u044f \u0434\u043e\u043a\u0443\u043c\u0435\u043d\u0442\u043e\u0432)</label>\n"
    "          <input\n"
    "            className={styles.profileInput}\n"
    "            value={current.descriptor}\n"
    "            onChange={e => setForm({ ...current, descriptor: e.target.value })}\n"
    "            placeholder=\"\u0418\u043d\u0434\u0438\u0432\u0438\u0434\u0443\u0430\u043b\u044c\u043d\u044b\u0439 \u043f\u043e\u0448\u0438\u0432 \u043e\u0434\u0435\u0436\u0434\u044b...\"\n"
    "          />\n"
    "        </div>\n"
    "        <div className={styles.profileField}>\n"
    "          <label className={styles.profileLabel}>\u041a\u043e\u043d\u0442\u0430\u043a\u0442 \u043f\u043e\u0434\u0434\u0435\u0440\u0436\u043a\u0438</label>\n"
    "          <input\n"
    "            className={styles.profileInput}\n"
    "            value={current.supportLabel}\n"
    "            onChange={e => setForm({ ...current, supportLabel: e.target.value })}\n"
    "            placeholder=\"\u0422\u0435\u043b.: +7 705...\"\n"
    "          />\n"
    "        </div>\n"
)

if old_jsx in content:
    content = content.replace(old_jsx, new_jsx)
    print('profile JSX fixed')
else:
    print('JSX NOT found')

# Add publicIntakeTitle and publicIntakeDescription fields after the enabled checkbox
old_checkbox = (
    "        <label className={styles.profileCheckbox}>\n"
    "          <input\n"
    "            type=\"checkbox\"\n"
    "            checked={current.publicIntakeEnabled}\n"
    "            onChange={e => setForm({ ...current, publicIntakeEnabled: e.target.checked })}\n"
    "          />\n"
    "          <span>\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u0443\u044e \u0444\u043e\u0440\u043c\u0443 \u0437\u0430\u044f\u0432\u043e\u043a</span>\n"
    "        </label>\n"
)

new_checkbox = (
    "        <label className={styles.profileCheckbox}>\n"
    "          <input\n"
    "            type=\"checkbox\"\n"
    "            checked={current.publicIntakeEnabled}\n"
    "            onChange={e => setForm({ ...current, publicIntakeEnabled: e.target.checked })}\n"
    "          />\n"
    "          <span>\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u043f\u0443\u0431\u043b\u0438\u0447\u043d\u0443\u044e \u0444\u043e\u0440\u043c\u0443 \u0437\u0430\u044f\u0432\u043e\u043a</span>\n"
    "        </label>\n"
    "        {current.publicIntakeEnabled && (\n"
    "          <>\n"
    "            <div className={styles.profileField}>\n"
    "              <label className={styles.profileLabel}>\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a \u0444\u043e\u0440\u043c\u044b \u0437\u0430\u044f\u0432\u043e\u043a</label>\n"
    "              <input\n"
    "                className={styles.profileInput}\n"
    "                value={current.publicIntakeTitle}\n"
    "                onChange={e => setForm({ ...current, publicIntakeTitle: e.target.value })}\n"
    "                placeholder=\"\u041e\u0441\u0442\u0430\u0432\u044c\u0442\u0435 \u0437\u0430\u044f\u0432\u043a\u0443 \u043d\u0430 \u043f\u043e\u0448\u0438\u0432\"\n"
    "              />\n"
    "            </div>\n"
    "            <div className={styles.profileField}>\n"
    "              <label className={styles.profileLabel}>\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435 \u0444\u043e\u0440\u043c\u044b</label>\n"
    "              <input\n"
    "                className={styles.profileInput}\n"
    "                value={current.publicIntakeDescription}\n"
    "                onChange={e => setForm({ ...current, publicIntakeDescription: e.target.value })}\n"
    "                placeholder=\"\u0423\u043a\u0430\u0436\u0438\u0442\u0435 \u043c\u043e\u0434\u0435\u043b\u044c, \u0440\u0430\u0437\u043c\u0435\u0440, \u043f\u043e\u0436\u0435\u043b\u0430\u043d\u0438\u044f...\"\n"
    "              />\n"
    "            </div>\n"
    "          </>\n"
    "        )}\n"
)

if old_checkbox in content:
    content = content.replace(old_checkbox, new_checkbox)
    print('public intake fields added')
else:
    print('checkbox NOT found')

with open('src/pages/workzone/chapan/settings/ChapanSettings.tsx', 'wb') as f:
    f.write(content.encode('utf-8'))
