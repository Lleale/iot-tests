import fs from 'fs';
import { Command } from 'commander';
import { exit } from 'process';

const cmd = new Command();

let replacements = null;
const replace = function(item) {

    if(item.request == undefined)
    {
        for (var subItem of item.item)
        {
            replace(subItem);
        }
    }
    else
    {
        for(var replacement of replacements)
        {
            if(!new RegExp(replacement.nameRegex).test(item.name))
                continue;

            console.log(`Replacing item '${item.name}' by matched override '${replacement.nameRegex}'`);

            for(var key in replacement.overrides)
            {
                item[key] = replacement.overrides[key];
            }

            break;
        }
    }

    
}

cmd.option('-i, --input <path>', 'path to the input collection', '../../Collections/Охрана (через переменные дома).postman_collection.json')
    .option('-o, --output <path>', 'path to the output collection',  '../../Collections/Охрана (через новое API).postman_collection.json')
    .option('-r, --replace <path>', 'path to the replacements', 'Охрана_переменные_в_новое_API.replacement.json');

cmd.parse(process.argv);
const options = cmd.opts();

if(options.input == undefined)
{
    console.error('No input!');
    exit(1);
}
if(options.output == undefined)
{
    console.error('No output!');
    exit(1);
}
if(options.replace == undefined)
{
    console.error('No replace!');
    exit(1);
}

let inputCollection = JSON.parse(fs.readFileSync(options.input).toString());
let toReplace = JSON.parse(fs.readFileSync(options.replace).toString());
replacements = toReplace.replacements;

inputCollection.info.name = toReplace.newCollectionName;
replace(inputCollection);

console.log(`Saving output collection to '${options.output}'`);
fs.writeFileSync(options.output, JSON.stringify(inputCollection));
