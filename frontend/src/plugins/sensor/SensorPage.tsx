import React from 'react';
import ConfigurableSensorDiagram from '@/components/ConfigurableSensorDiagram';
import MuccaSVG from '@/assets/svg/mucca.svg';
import Adaq8SVG from '@/assets/svg/ADAQ 8.svg';
import Adaq4SVG from '@/assets/svg/ADAQ 4.svg';
import MonStrSVG from '@/assets/svg/MonStr.svg';
import { Playfair_Display } from 'next/font/google';

const playfairDisplay = Playfair_Display({ subsets: ['latin'] });


const SensorPage = () => {
  return (
    <div className="overflow-y-auto h-screen p-4"> {/* Aggiunto un padding per una migliore visualizzazione */}
      {/* <ConfigurableSensorDiagram SvgComponent={MuccaSVG} diagramType="DEFAULT" /> */}
      {/* <hr className="my-8" /> */}
      <header className='flex justify-center'>
        <h2 className={`${playfairDisplay.className} text-4xl`}> ADAQ 8 </h2>
      </header>
      <ConfigurableSensorDiagram SvgComponent={Adaq8SVG} diagramType="DEFAULT" />
      <hr className="my-8" />
      <header className='flex justify-center'>
        <h2 className={`${playfairDisplay.className} text-4xl`}> ADAQ 4 </h2>
      </header>
      <ConfigurableSensorDiagram SvgComponent={Adaq4SVG} diagramType="ADAQ4" />
      <hr className="my-8" />
      <header className='flex justify-center'>
        <h2 className={`${playfairDisplay.className} text-4xl`}> MonStr </h2>
      </header>
      <ConfigurableSensorDiagram SvgComponent={MonStrSVG} diagramType="MONSTR" />
    </div>
  );
};

export default SensorPage;
