/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */

import * as fs from "fs";
import * as util from "util";
import { PackageDetails } from "./packageJson";
import { generateTypeDataForProject, toTypeString, TypeData } from "./typeData";

const createTestFileHeader = (oldVersion: string)=>
`/*!
 * Copyright (c) Microsoft Corporation and contributors. All rights reserved.
 * Licensed under the MIT License.
 */
/*
 * THIS IS AN AUTOGENERATED FILE. DO NOT EDIT THIS FILE DIRECTLY.
 * Generated by fluid-type-validator in @fluidframework/build-tools.
 */
import * as old from "${oldVersion}";
import * as current from "../../index";

type TypeOnly<T> = {
    [P in keyof T]: TypeOnly<T[P]>;
};
`;

export async function generateTests(packageDetails: PackageDetails) {

    const currentProjectData = await generateTypeDataForProject(packageDetails.packageDir, undefined);
    const stats: {dirs: number, files:number, tests: number} ={dirs: 0, files:0,tests:0};
    for(const oldVersion of packageDetails.oldVersions){
        const testString: string[]=[
            createTestFileHeader(oldVersion)
        ];
        const oldProjectData = await generateTypeDataForProject(packageDetails.packageDir, oldVersion);
        const currentTypeMap = new Map<string, TypeData>(currentProjectData.typeData.map((v)=>[getFullTypeName(v),v]));
        for(const oldTypeData of oldProjectData.typeData){
            const oldType: TestCaseTypeData = {
                prefix: "old",
                ... oldTypeData,
                removed: false
            }
            const currentTypeData = currentTypeMap.get(getFullTypeName(oldTypeData));
            // if the current package is missing a type, we will use the old type data.
            // this can represent a breaking change which can be disable in the package.json.
            // this can also happen for type changes, like type to interface, which can remain
            // compatible.
            const currentType: TestCaseTypeData = currentTypeData === undefined
            ?{
                prefix: "current",
                ... oldTypeData,
                kind:`Removed${oldTypeData.kind}`,
                removed: true
            }
            :{
                prefix: "current",
                ... currentTypeData,
                removed: false
            };
            const broken = currentProjectData.packageDetails.broken;
            // look for settings not under version, then fall back to version for back compat
            const brokenData = broken?.[getFullTypeName(currentType)];

            testString.push(`/*`)
            testString.push(`* Validate forward compat by using old type in place of current type`);
            testString.push(`* If breaking change required, add in package.json under typeValidation.broken:`);
            testString.push(`* "${getFullTypeName(currentType)}": {"forwardCompat": false}`);
            testString.push("*/");
            testString.push(...  buildTestCase(oldType, currentType, brokenData?.forwardCompat ?? true));

            testString.push("");

            testString.push(`/*`)
            testString.push(`* Validate back compat by using current type in place of old type`);
            testString.push(`* If breaking change required, add in package.json under typeValidation.broken:`);
            testString.push(`* "${getFullTypeName(currentType)}": {"backCompat": false}`);
            testString.push("*/");
            testString.push(... buildTestCase(currentType, oldType, brokenData?.backCompat ?? true));
            testString.push("");
        }
        stats.tests+= oldProjectData.typeData.length;

        const testPath =`${packageDetails.packageDir}/src/test/types`;
        if(! await util.promisify(fs.exists)(testPath)){
            stats.dirs ++;
            await util.promisify(fs.mkdir)(testPath, {recursive: true});
        }
        // remove scope if it exists
        const oldVersionNameForFile = oldVersion.indexOf("/") > 0
            ? oldVersion.substring(oldVersion.indexOf("/")+1)
            : oldVersion;

        stats.files ++;
        await util.promisify(fs.writeFile)(
            `${testPath}/validate${oldVersionNameForFile.split("-").map((p)=>p[0].toUpperCase()+p.substring(1)).join("")}.ts`,
            testString.join("\n"));
    }
    return stats;
}


interface TestCaseTypeData extends TypeData{
    prefix: "old" | "current",
    removed: boolean
}

function buildTestCase(getAsType:TestCaseTypeData, useType:TestCaseTypeData, isCompatible: boolean){

    if(!isCompatible && (getAsType.removed || useType.removed)){
        return "";
    }

    const getSig =`get_${getAsType.prefix}_${getFullTypeName(getAsType).replace(".","_")}`;
    const useSig =`use_${useType.prefix}_${getFullTypeName(useType).replace(".","_")}`;
    const expectErrorString = "    // @ts-expect-error compatibility expected to be broken";
    const testString: string[] =[];

    testString.push(`declare function ${getSig}():`);
    testString.push(`    ${toTypeString(getAsType.prefix, getAsType)};`);
    testString.push(`declare function ${useSig}(`);
    testString.push(`    use: ${toTypeString(useType.prefix, useType)});`);
    testString.push(`${useSig}(`);
    if(!isCompatible) {
        testString.push(expectErrorString);
    }
    testString.push(`    ${getSig}());`);
    return testString;
}

function getFullTypeName(typeData: TypeData){
    return `${typeData.kind}_${typeData.name}`
}