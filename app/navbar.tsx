'use client';

import { Fragment } from 'react';
import { usePathname } from 'next/navigation';
import { Disclosure, Menu, Transition } from '@headlessui/react';
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline';
import ThemeToggle, { useTheme } from '../components/theme-toggle';

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
  const isDark = useTheme();

  return (
    <Disclosure as="nav" className="bg-[var(--bg-secondary)] border-b border-[var(--border-color)]">
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
                    <img
                      src={isDark ? "/fry-logo-light.png" : "/fry-logo-dark.png"}
                      alt="Fry Networks"
                      className="h-8 w-auto"
                    />
                    <span className="text-[var(--text-secondary)] text-sm font-medium">Vote</span>
                  </div>
                </button>
                <div className="hidden sm:-my-px sm:ml-8 sm:flex sm:space-x-6">
                  {navigation.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className={classNames(
                        pathname === item.href
                          ? 'border-[#e74c3c] text-[var(--text-heading)]'
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-color)]',
                        'inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium transition-colors duration-150'
                      )}
                      aria-current={pathname === item.href ? 'page' : undefined}
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
              </div>
              <div className="hidden sm:ml-6 sm:flex sm:items-center gap-3">
                <ThemeToggle />
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
              <div className="-mr-2 flex items-center sm:hidden gap-2">
                <ThemeToggle />
                <Disclosure.Button className="inline-flex items-center justify-center rounded-lg bg-[var(--bg-secondary)] p-2 text-[var(--text-secondary)] hover:bg-[var(--border-color)] hover:text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[#e74c3c] focus:ring-offset-2 focus:ring-offset-[var(--bg-primary)]">
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

          <Disclosure.Panel className="sm:hidden bg-[var(--bg-secondary)]">
            <div className="space-y-1 pt-2 pb-3">
              {navigation.map((item) => (
                <Disclosure.Button
                  key={item.name}
                  as="a"
                  href={item.href}
                  className={classNames(
                    pathname === item.href
                      ? 'bg-[var(--bg-card)] border-[#e74c3c] text-[var(--text-heading)]'
                      : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card)] hover:border-[var(--border-color)] hover:text-[var(--text-primary)]',
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
