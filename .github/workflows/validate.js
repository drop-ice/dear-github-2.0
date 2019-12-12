const {spawnSync} = require('child_process');
const parseDiff = require('parse-diff');

const baseRef = process.env.GITHUB_BASE_REF;

console.error('base ref:', baseRef);

const proc = spawnSync('git', [
	'diff',
	`origin/${baseRef}..HEAD`,
	'--oneline'
]);

if (proc.error) throw proc.error;

if (proc.status !== 0) {
	console.error('❗There was a problem fetching the diff:');
	console.error(proc.stderr.toString('utf-8'));
	process.exit(1);
}

const diffOutput = proc.stdout.toString('utf-8');
const diff = parseDiff(diffOutput);

console.error('\n\n############## DIFF ##############');
console.error(diffOutput);
console.error('############## END DIFF ##############\n\n');

const readme = diff.filter(({from, to}) => (from === to) && (from == 'README.md'));


// Check if change is in README
if (readme.length !== 1) {
	console.error('❗PR changes files other than README');
	process.exit(1);
}

console.log('✅ PR only changes README');


// Check if only one line is changed
const chunks = readme[0].chunks;

if (chunks.length !== 1) {
	console.error('❗Too many things changed in the README.');
	process.exit(1);
} 

let addedIndex = -1;
const added = chunks[0].changes.filter((c, i) => {
	if (c.add) {
		addedIndex = i;
		return true;
	}

	return false;
});

if (added.length !== 1) {
	console.error('❗Expected exactly one added line');
	process.exit(1);
}

console.log('✅ PR only changes one line');	


//Check if change is somewhere in the middle of signers
if (addedIndex === 0) {
	console.error('❗Added line to beginning of README.');
	process.exit(1);
}

if (addedIndex === chunks[0].changes.length - 1) {
	console.error('❗Added line to end of README -- please sign in alphabetical order by last name');
	process.exit(1);
}

console.log('✅ Line is not at beginning or end of signers');


//Check format of signature
const linePattern = /^\- ([^,]+), @([^ ,]+)(?: \([^)]+\))?$/;

// The substring is to cut off the initial "+"/"-", if any
const beforeLine = chunks[0].changes[addedIndex - 1].content.substring(1).match(linePattern);
const afterLine = chunks[0].changes[addedIndex + 1].content.substring(1).match(linePattern);
const line = added[0].content.substring(1).match(linePattern);

if (!beforeLine) {
	console.error('❗Line before does not pass validation');
	process.exit(1);
}

if (!afterLine) {
	console.error('❗Line after does not pass validation');
	process.exit(1);
}

if (!line) {
	console.error('❗Invalid format for signature line');
	process.exit(1);
}

console.log('✅ Signature is formatted correctly');


//(naively) check alphabetization
const beforeLastName = beforeLine[1].trim().split(',', 1)[0].split(/\s+/g).pop().toLowerCase();
const afterLastName = afterLine[1].trim().split(',', 1)[0].split(/\s+/g).pop().toLowerCase();
const lastName = line[1].trim().split(',', 1)[0].split(/\s+/g).pop().toLowerCase();

if (beforeLastName > lastName || afterLastName < lastName) {
	console.error('❗Signature does not appear to be alphabetical order');
	console.error('- Last name detected:', lastName);
	console.error('- The code used to check alphabetical order is very naive -- please ignore if it gets it wrong!');
	process.exit(1);
}

console.log('✅ Alphabetization looks okay');


//Check if PR is from signee
const pullRequester = process.env.GITHUB_ACTOR.toLowerCase();
const isOriginalPR = ( pullRequester == line[2].toLowerCase() );
const isMergeResolution = ( pullRequester == 'drop-ice' );

if (!( isOriginalPR || isMergeResolution )) {
	console.error('❗Added username does not match pull requester!');
	console.error('- Detected from README:', line[2]);
	console.error('- GITHUB_ACTOR:', process.env.GITHUB_ACTOR);
	process.exit(1);
}

console.log('✅ Pull request is made by signer');


console.log('\n\n✅ SIGNATURE PASSED STRICT VALIDATION');
