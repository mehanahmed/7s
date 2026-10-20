
export type District = {
  name: string;
  aliases?: string[];
  thanas?: string[];
};

export type Division = {
  division: string;
  districts: District[];
};

const rawData = {
  "divisions": [
    {
      "name": "Dhaka (ঢাকা)",
      "districts": [
        "Dhaka (ঢাকা, Dhanmondi, Mohammadpur, Mirpur, Gulshan, গুলশান, banasree, Uttara, Paltan)",
        "Faridpur (ফরিদপুর)",
        "Gazipur (গাজীপুর)",
        "Gopalganj (গোপালগঞ্জ)",
        "Kishoreganj (কিশোরগঞ্জ)",
        "Madaripur (মাদারীপুর)",
        "Manikganj (মানিকগঞ্জ, Manikgonj)",
        "Munshiganj (মুন্সীগঞ্জ, Munshigonj)",
        "Narayanganj (নারায়ণগঞ্জ)",
        "Narsingdi (নরসিংদী)",
        "Rajbari (রাজবাড়ী)",
        "Shariatpur (শরীয়তপুর)",
        "Tangail (টাঙ্গাইল, টাংগাইল)"
      ]
    },
    {
      "name": "Chattogram (চট্টগ্রাম)",
      "districts": [
        "Chattogram (চট্টগ্রাম, Chittagong)",
        "Cox’s Bazar (কক্সবাজার)",
        "Cumilla (কুমিল্লা, Comilla)",
        "Brahmanbaria (ব্রাহ্মণবাড়িয়া)",
        "Chandpur (চাঁদপুর)",
        "Feni (ফেনী)",
        "Lakshmipur (লক্ষ্মীপুর)",
        "Noakhali (নোয়াখালী)",
        "Khagrachari (খাগড়াছড়ি)",
        "Bandarban (বান্দরবান)",
        "Rangamati (রাঙামাটি)"
      ]
    },
    {
      "name": "Khulna (খুলনা)",
      "districts": [
        "Khulna (খুলনা)",
        "Bagerhat (বাগেরহাট)",
        "Satkhira (সাতক্ষীরা)",
        "Jessore (যশোর)",
        "Jhenaidah (ঝিনাইদহ)",
        "Magura (মাগুরা)",
        "Narail (নড়াইল)",
        "Chuadanga (চুয়াডাঙ্গা)",
        "Meherpur (মেহেরপুর)",
        "Kushtia (কুষ্টিয়া)"
      ]
    },
    {
      "name": "Rajshahi (রাজশাহী)",
      "districts": [
        "Rajshahi (রাজশাহী)",
        "Bogura (বগুড়া)",
        "Chapainawabganj (চাঁপাইনবাবগঞ্জ)",
        "Joypurhat (জয়পুরহাট)",
        "Naogaon (নওগাঁ)",
        "Natore (নাটোর)",
        "Pabna (পাবনা)",
        "Sirajganj (সিরাজগঞ্জ)"
      ]
    },
    {
      "name": "Barishal (বরিশাল)",
      "districts": [
        "Barishal (বরিশাল)",
        "Barguna (বরগুনা)",
        "Bhola (ভোলা)",
        "Jhalokathi (ঝালকাঠি)",
        "Patuakhali (পটুয়াখালী)",
        "Pirojpur (পিরোজপুর)"
      ]
    },
    {
      "name": "Sylhet (সিলেট)",
      "districts": [
        "Sylhet (সিলেট)",
        "Habiganj (হবিগঞ্জ)",
        "Moulvibazar (মৌলভীবাজার)",
        "Sunamganj (সুনামগঞ্জ)"
      ]
    },
    {
      "name": "Rangpur (রংপুর)",
      "districts": [
        "Rangpur (রংপুর)",
        "Dinajpur (দিনাজপুর)",
        "Kurigram (কুড়িগ্রাম)",
        "Gaibandha (গাইবান্ধা)",
        "Lalmonirhat (লালমনিরহাট)",
        "Nilphamari (নীলফামারী)",
        "Panchagarh (পঞ্চগড়)",
        "Thakurgaon (ঠাকুরগাঁও)"
      ]
    },
    {
      "name": "Mymensingh (ময়মনসিংহ)",
      "districts": [
        "Mymensingh (ময়মনসিংহ, Mymonsingh)",
        "Jamalpur (জামালপুর)",
        "Netrokona (নেত্রকোনা)",
        "Sherpur (শেরপুর)"
      ]
    }
  ]
};

const parseName = (nameString: string): { name: string; aliases: string[] } => {
  const match = nameString.match(/^(.*?)\s*\((.*?)\)$/);
  if (match) {
    const englishName = match[1].trim();
    const otherNames = match[2].split(',').map(s => s.trim());
    const aliases = [...otherNames];

    // Special handling for Cox's Bazar
    if (englishName.toLowerCase().includes("cox")) {
      aliases.push("coxs bazar", "coxsbazar", "cox bazar", "coxbazar");
    }

    return { name: englishName, aliases };
  }
  return { name: nameString.trim(), aliases: [] };
};

export const divisions: Division[] = rawData.divisions.map(division => {
    const parsedDivision = parseName(division.name);
    return {
        division: parsedDivision.name,
        districts: division.districts.map(districtString => {
            const parsedDistrict = parseName(districtString);
            return {
                name: parsedDistrict.name,
                aliases: parsedDistrict.aliases,
                thanas: []
            };
        })
    };
});
