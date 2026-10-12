class_name SourcesRegister
extends RefCounted
## The one list of sources the game draws on (spec: "Sources register"). The Sources page is
## built from it, and every factual claim or piece of state vocabulary in the game must trace
## to an id here. Links were checked to resolve when added.


static func entries() -> Array[Source]:
	return [
		Source.new(
			"aspi-2020",
			"Uyghurs for Sale: 'Re-education', forced labour and surveillance beyond Xinjiang",
			"Vicky Xiuzhong Xu et al., Australian Strategic Policy Institute",
			"March 2020",
			"https://www.aspi.org.au/report/uyghurs-sale",
			"Labour transfers, minders, dormitories, ideological training outside working hours"
		),
		Source.new(
			"zenz-2020",
			(
				"Coercive Labor in Xinjiang: Labor Transfer and the Mobilization of Ethnic"
				+ " Minorities to Pick Cotton"
			),
			"Adrian Zenz, Newlines Institute for Strategy and Policy",
			"December 2020",
			(
				"https://newlinesinstitute.org/uyghurs/coercive-labor-in-xinjiang-labor-transfer"
				+ "-and-the-mobilization-of-ethnic-minorities-to-pick-cotton/"
			),
			(
				'Cotton-picking mobilisation under "poverty alleviation", quotas,'
				+ ' "military-style management", police monitoring'
			)
		),
		Source.new(
			"shu-2021",
			"Laundering Cotton: How Xinjiang Cotton is Obscured in International Supply Chains",
			"Laura T. Murphy et al., Sheffield Hallam University",
			"November 2021",
			"https://www.shu.ac.uk/news/all-articles/latest-news/laundering-cotton-report",
			"Where the cotton goes after the field: the supply chain"
		),
		Source.new(
			"ohchr-2022",
			"OHCHR Assessment of human rights concerns in the Xinjiang Uyghur Autonomous Region",
			"Office of the UN High Commissioner for Human Rights (OHCHR)",
			"31 August 2022",
			(
				"https://www.ohchr.org/en/documents/country-reports/ohchr-assessment-human-rights"
				+ "-concerns-xinjiang-uyghur-autonomous-region"
			),
			'"Vocational Education and Training Centres" and the UN\'s findings'
		),
		Source.new(
			"xpf-2022",
			"The Xinjiang Police Files",
			"Victims of Communism Memorial Foundation and a media consortium",
			"May 2022",
			"https://victimsofcommunism.org/xinjiang-police-files-press-release/",
			"Detention, surveillance and police directives"
		),
		Source.new(
			"zenz-2019",
			"Break Their Roots: Evidence for China's Parent-Child Separation Campaign in Xinjiang",
			"Adrian Zenz, Journal of Political Risk",
			"July 2019",
			(
				"https://www.jpolrisk.com/break-their-roots-evidence-for-chinas-parent-child"
				+ "-separation-campaign-in-xinjiang/"
			),
			(
				"Children separated from detained parents into boarding schools: Mandarin-only"
				+ " schooling, Party slogans, teachers in place of parents"
			)
		),
	]


## Everything wrong with the register: incomplete entries and repeated ids.
static func problems(sources: Array[Source]) -> Array[String]:
	var found: Array[String] = []
	var seen: Dictionary = {}
	for source in sources:
		found.append_array(source.problems())
		if seen.has(source.id):
			found.append("source id %s is used more than once" % source.id)
		seen[source.id] = true
	return found
