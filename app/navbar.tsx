'use client';

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Home', href: '/' },
  { name: 'Vote', href: '/vote' },
  { name: 'Last Vote', href: '/lastvote' },
  { name: 'All Votes', href: '/allvotes' },
  { name: 'My Stakes', href: '/stakes' }
];

function classNames(...classes: string[]) {
  return classes.filter(Boolean).join(' ');
}

export default function Navbar() {
  const pathname = usePathname();

  return (
    <Disclosure as="nav" className="bg-[#1a1a1a] border-b border-[#333333]">
      {({ open }) => (
        <>
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex h-16 justify-between">
              <div className="flex">
                <button
                  onClick={() => {
                    window.location.href = '/';
                  }}
                  className="flex items-center"
                >
                  <div className="flex flex-shrink-0 items-center gap-2">
                    <span className="text-xl font-bold text-white">FRY</span>
                    <span className="text-xl text-[#999999]">Vote</span>
                  </div>
                </button>
                <div className="hidden sm:-my-px sm:ml-8 sm:flex sm:space-x-6">
                  {navigation.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className={classNames(
                        pathname === item.href
                          ? 'border-[#60a5fa] text-white'
                          : 'border-transparent text-[#999999] hover:text-[#e0e0e0] hover:border-[#555555]',
                        'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-150'
                      )}
                      aria-current={pathname === item.href ? 'page' : undefined}
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:items-center">
                <Menu as="div" className="relative ml-3">
                  <Transition
                    as={Fragment}
                    enter="transition ease-out duration-200"
                    enterFrom="transform opacity-0 scale-95"
                    enterTo="transform opacity-100 scale-100"
                    leave="transition ease-in duration-75"
                    leaveFrom="transform opacity-100 scale-100"
                    leaveTo="transform opacity-0 scale-95"
                  ></Transition>
                </Menu>
              </div>
              <div className="-mr-2 flex items-center sm:hidden">
                <Disclosure.Button className="inline-flex items-center justify-center rounded-lg bg-[#1a1a1a] p-2 text-[#999999] hover:bg-[#2a2a2a] hover:text-[#e0e0e0] focus:outline-none focus:ring-2 focus:ring-[#60a5fa] focus:ring-offset-2 focus:ring-offset-[#0f0f0f]">
                  <span className="sr-only">Open main menu</span>
                  {open ? (
                    <XMarkIcon className="block h-6 w-6" aria-hidden="true" />
                  ) : (
                    <Bars3Icon className="block h-6 w-6" aria-hidden="true" />
                  )}
                </Disclosure.Button>
              </div>
            </div>
          </div>

          <Disclosure.Panel className="sm:hidden bg-[#1a1a1a]">
            <div className="space-y-1 pt-2 pb-3">
              {navigation.map((item) => (
                <Disclosure.Button
                  key={item.name}
                  as="a"
                  href={item.href}
                  className={classNames(
                    pathname === item.href
                      ? 'bg-[#2a2a2a] border-[#60a5fa] text-white'
                      : 'border-transparent text-[#999999] hover:bg-[#252525] hover:border-[#555555] hover:text-[#e0e0e0]',
                    'block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors duration-150'
                  )}
                  aria-current={pathname === item.href ? 'page' : undefined}
                >
                  {item.name}
                </Disclosure.Button>
              ))}
            </div>
          </Disclosure.Panel>
        </>
      )}
    </Disclosure>
  );
}
